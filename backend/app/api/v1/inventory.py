from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db.session import get_db
from app.models.catalog import CatalogItem
from app.models.inventory import NarcoticLog, PurchaseOrder, PurchaseOrderLine, StockTransfer, Supplier, WastageLog
from app.models.org import Warehouse
from app.models.users import User
from app.schemas.actions import DispenseIn, MedicineIn, MedicineUpdateIn, StockReceiveIn, WastageIn
from app.services.inventory_service import (
    alerts,
    approve_wastage,
    create_medicine,
    dispense,
    nearest_expiry,
    receive_po_line,
    receive_stock,
    stock_on_hand,
)
from app.services.utils import next_number

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/items")
def items(
    warehouse_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require("inventory", "inventory.read", "pharmacy", "pos", "nursing", "reports")),
):
    rows = db.query(CatalogItem).filter(CatalogItem.is_stock == True).order_by(CatalogItem.name).all()  # noqa: E712
    out = []
    for r in rows:
        on_hand = stock_on_hand(db, r.id, warehouse_id)
        exp = nearest_expiry(db, r.id, warehouse_id)
        out.append({
            "item": r,
            "on_hand": on_hand,
            "nearest_expiry": str(exp) if exp else None,
            "is_low": on_hand <= r.min_stock,
        })
    return out


@router.post("/medicines")
def add_medicine(data: MedicineIn, db: Session = Depends(get_db), user: User = Depends(require("inventory", "po", "pos"))):
    try:
        item = create_medicine(db, data.name, data.sku, data.barcode, data.price, data.cost, data.min_stock, user.id)
        db.commit()
        db.refresh(item)
        return item
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/medicines/{item_id}")
def update_medicine(item_id: int, data: MedicineUpdateIn, db: Session = Depends(get_db), user: User = Depends(require("inventory", "po", "pos"))):
    item = db.get(CatalogItem, item_id)
    if not item or not item.is_stock:
        raise HTTPException(404)
    if data.name is not None:
        item.name = data.name.strip()
        item.name_mm = data.name.strip()
    if data.price is not None:
        item.price = data.price
    if data.cost is not None:
        item.cost = data.cost
    if data.min_stock is not None:
        item.min_stock = data.min_stock
    db.commit()
    db.refresh(item)
    return item


@router.post("/receive")
def receive_stock_batch(data: StockReceiveIn, db: Session = Depends(get_db), user: User = Depends(require("inventory", "po", "pos"))):
    try:
        batch = receive_stock(
            db,
            data.item_id,
            data.warehouse_id,
            data.qty,
            data.unit_cost,
            data.batch_no,
            data.expiry_date,
            user.id,
            data.selling_price,
            data.min_stock,
        )
        db.commit()
        return {"ok": True, "batch_id": batch.id}
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/alerts")
def inventory_alerts(warehouse_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("inventory", "pharmacy", "pos"))):
    return alerts(db, warehouse_id)


@router.get("/suppliers")
def suppliers(db: Session = Depends(get_db), _: User = Depends(require("inventory", "po"))):
    return db.query(Supplier).all()


@router.post("/suppliers")
def create_supplier(name: str, phone: str = "", db: Session = Depends(get_db), _: User = Depends(require("po", "inventory"))):
    s = Supplier(name=name, phone=phone)
    db.add(s)
    db.commit()
    return s


@router.post("/purchase-orders")
def create_po(supplier_id: int, warehouse_id: int, db: Session = Depends(get_db), _: User = Depends(require("po"))):
    po = PurchaseOrder(number=next_number(db, "po", "PO-"), supplier_id=supplier_id, warehouse_id=warehouse_id, status="draft")
    db.add(po)
    db.commit()
    return po


@router.post("/purchase-orders/{po_id}/lines")
def add_po_line(po_id: int, item_id: int, qty: float, unit_cost: float, batch_no: str = "", expiry_date: date | None = None, db: Session = Depends(get_db), _: User = Depends(require("po"))):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404)
    line = PurchaseOrderLine(po_id=po_id, item_id=item_id, qty=qty, unit_cost=unit_cost, batch_no=batch_no, expiry_date=expiry_date)
    db.add(line)
    po.total += qty * unit_cost
    db.commit()
    return line


@router.post("/purchase-orders/{po_id}/receive")
def receive_po(po_id: int, db: Session = Depends(get_db), user: User = Depends(require("po"))):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404)
    for line in po.lines:
        receive_po_line(db, line.item_id, po.warehouse_id, line.batch_no, line.expiry_date, line.qty, line.unit_cost)
    po.status = "received"
    db.commit()
    return po


@router.get("/purchase-orders")
def list_po(db: Session = Depends(get_db), _: User = Depends(require("po", "inventory"))):
    return db.query(PurchaseOrder).order_by(PurchaseOrder.id.desc()).limit(50).all()


@router.get("/batches")
def list_batches(db: Session = Depends(get_db), _: User = Depends(require("inventory", "pharmacy"))):
    from app.models.inventory import StockBatch

    rows = db.query(StockBatch).filter(StockBatch.qty > 0).order_by(StockBatch.id.desc()).limit(100).all()
    out = []
    for b in rows:
        out.append({
            "id": b.id,
            "item_id": b.item_id,
            "item_name": b.item.name if b.item else "",
            "warehouse_id": b.warehouse_id,
            "batch_no": b.batch_no,
            "expiry_date": str(b.expiry_date) if b.expiry_date else "",
            "qty": b.qty,
            "unit_cost": b.unit_cost,
        })
    return out


@router.get("/wastage")
def list_wastage(status: str = "pending", db: Session = Depends(get_db), _: User = Depends(require("wastage", "inventory"))):
    return db.query(WastageLog).filter(WastageLog.status == status).order_by(WastageLog.id.desc()).limit(50).all()


@router.post("/dispense")
def dispense_item(data: DispenseIn, db: Session = Depends(get_db), user: User = Depends(require("dispense", "pharmacy"))):
    item = db.get(CatalogItem, data.item_id)
    if not item:
        raise HTTPException(404)
    picks = dispense(db, item, data.warehouse_id, data.qty, data.ref, user.id)
    if item.is_controlled:
        for batch, take in picks:
            db.add(NarcoticLog(item_id=item.id, batch_id=batch.id, patient_id=data.patient_id, qty=take, direction="out"))
    db.commit()
    return {"ok": True}


@router.post("/wastage")
def request_wastage(data: WastageIn, db: Session = Depends(get_db), user: User = Depends(require("wastage"))):
    log = WastageLog(batch_id=data.batch_id, qty=data.qty, reason=data.reason, requested_by=user.id)
    db.add(log)
    db.commit()
    return log


@router.post("/wastage/{log_id}/approve")
def approve(log_id: int, db: Session = Depends(get_db), user: User = Depends(require("wastage", "inventory"))):
    log = db.get(WastageLog, log_id)
    if not log:
        raise HTTPException(404)
    approve_wastage(db, log, user.id)
    db.commit()
    return log


@router.post("/transfer")
def transfer(from_warehouse_id: int, to_warehouse_id: int, batch_id: int, qty: float, db: Session = Depends(get_db), _: User = Depends(require("transfers"))):
    from app.models.inventory import StockBatch

    batch = db.get(StockBatch, batch_id)
    if not batch or batch.qty < qty:
        raise HTTPException(400, "Insufficient qty")
    batch.qty -= qty
    dest = StockBatch(item_id=batch.item_id, warehouse_id=to_warehouse_id, batch_no=batch.batch_no, expiry_date=batch.expiry_date, qty=qty, unit_cost=batch.unit_cost)
    db.add(dest)
    db.flush()
    db.add(StockTransfer(from_warehouse_id=from_warehouse_id, to_warehouse_id=to_warehouse_id, item_id=batch.item_id, batch_id=batch.id, qty=qty))
    db.commit()
    return {"ok": True}


@router.get("/narcotics")
def narcotics(db: Session = Depends(get_db), _: User = Depends(require("narcotics", "pharmacy"))):
    return db.query(NarcoticLog).order_by(NarcoticLog.id.desc()).limit(100).all()


@router.get("/warehouses")
def warehouses(db: Session = Depends(get_db), _: User = Depends(require("inventory.read", "pharmacy", "pos"))):
    return db.query(Warehouse).all()


@router.post("/warehouses")
def create_warehouse(name: str, branch_id: int, db: Session = Depends(get_db), _: User = Depends(require("inventory", "po", "pos"))):
    wh = Warehouse(name=name, branch_id=branch_id)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh
