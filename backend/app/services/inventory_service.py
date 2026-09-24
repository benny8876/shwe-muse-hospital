from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.catalog import CatalogItem
from app.models.inventory import StockBatch, StockMovement, WastageLog
from app.services.utils import audit


def stock_on_hand(db: Session, item_id: int, warehouse_id: int | None = None) -> float:
    q = db.query(func.coalesce(func.sum(StockBatch.qty), 0)).filter(StockBatch.item_id == item_id)
    if warehouse_id:
        q = q.filter(StockBatch.warehouse_id == warehouse_id)
    return float(q.scalar() or 0)


def pick_fefo(db: Session, item_id: int, warehouse_id: int, qty: float) -> list[tuple[StockBatch, float]]:
    batches = (
        db.query(StockBatch)
        .filter(StockBatch.item_id == item_id, StockBatch.warehouse_id == warehouse_id, StockBatch.qty > 0)
        .order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.id.asc())
        .all()
    )
    remaining = qty
    picks: list[tuple[StockBatch, float]] = []
    for b in batches:
        if remaining <= 0:
            break
        take = min(b.qty, remaining)
        b.qty -= take
        remaining -= take
        picks.append((b, take))
    if remaining > 0:
        raise ValueError("Insufficient stock")
    return picks


def dispense(db: Session, item: CatalogItem, warehouse_id: int, qty: float, ref: str, user_id: int | None):
    picks = pick_fefo(db, item.id, warehouse_id, qty)
    for batch, take in picks:
        db.add(StockMovement(item_id=item.id, batch_id=batch.id, qty_delta=-take, reason="dispense", ref=ref))
    audit(db, user_id, "dispense", "catalog_item", str(item.id), f"qty={qty} ref={ref}")
    return picks


def receive_stock(
    db: Session,
    item_id: int,
    warehouse_id: int,
    qty: float,
    unit_cost: float,
    batch_no: str,
    expiry: date | None,
    user_id: int | None,
    selling_price: float | None = None,
    min_stock: float | None = None,
):
    item = db.get(CatalogItem, item_id)
    if not item or not item.is_stock:
        raise ValueError("Medicine not found")
    if qty <= 0:
        raise ValueError("Quantity must be positive")
    if selling_price is not None:
        item.price = selling_price
    if min_stock is not None:
        item.min_stock = min_stock
    if unit_cost > 0:
        item.cost = unit_cost
    batch = receive_po_line(db, item_id, warehouse_id, batch_no, expiry, qty, unit_cost)
    audit(db, user_id, "stock_receive", "catalog_item", str(item_id), f"qty={qty} batch={batch_no}")
    return batch


def create_medicine(db: Session, name: str, sku: str, barcode: str, price: float, cost: float, min_stock: float, user_id: int | None):
    from app.services.utils import next_number

    code = sku.strip() or next_number(db, "sku", "MED-")
    if db.query(CatalogItem).filter(CatalogItem.sku == code).first():
        raise ValueError("SKU already exists")
    item = CatalogItem(
        sku=code,
        barcode=barcode or code,
        name=name.strip(),
        name_mm=name.strip(),
        category="drug",
        department="pharmacy",
        price=price,
        cost=cost,
        min_stock=min_stock,
        is_stock=True,
    )
    db.add(item)
    db.flush()
    audit(db, user_id, "medicine_create", "catalog_item", str(item.id), name)
    return item


def nearest_expiry(db: Session, item_id: int, warehouse_id: int | None = None) -> date | None:
    q = db.query(StockBatch).filter(StockBatch.item_id == item_id, StockBatch.qty > 0, StockBatch.expiry_date.isnot(None))
    if warehouse_id:
        q = q.filter(StockBatch.warehouse_id == warehouse_id)
    batch = q.order_by(StockBatch.expiry_date.asc()).first()
    return batch.expiry_date if batch else None


def receive_po_line(db: Session, item_id: int, warehouse_id: int, batch_no: str, expiry: date | None, qty: float, unit_cost: float):
    batch = StockBatch(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_no=batch_no or "BATCH",
        expiry_date=expiry,
        qty=qty,
        unit_cost=unit_cost,
    )
    db.add(batch)
    db.flush()
    db.add(StockMovement(item_id=item_id, batch_id=batch.id, qty_delta=qty, reason="purchase", ref=batch_no))
    return batch


def alerts(db: Session, warehouse_id: int | None = None):
    today = date.today()
    near = today + timedelta(days=30)
    q = db.query(StockBatch).join(CatalogItem)
    if warehouse_id:
        q = q.filter(StockBatch.warehouse_id == warehouse_id)
    batches = q.all()
    low, near_exp, expired = [], [], []
    seen = set()
    for b in batches:
        item = b.item
        if item.id not in seen:
            seen.add(item.id)
            total = stock_on_hand(db, item.id, warehouse_id)
            if total <= item.min_stock:
                low.append({"item_id": item.id, "name": item.name, "qty": total, "min": item.min_stock})
        if b.expiry_date and b.qty > 0:
            if b.expiry_date < today:
                expired.append({"batch_id": b.id, "item": item.name, "batch_no": b.batch_no, "expiry": str(b.expiry_date), "qty": b.qty})
            elif b.expiry_date <= near:
                near_exp.append({"batch_id": b.id, "item": item.name, "batch_no": b.batch_no, "expiry": str(b.expiry_date), "qty": b.qty})
    return {"low_stock": low, "near_expiry": near_exp, "expired": expired}


def approve_wastage(db: Session, log: WastageLog, approver_id: int):
    if log.status != "pending":
        raise ValueError("Already processed")
    batch = log.batch
    if batch.qty < log.qty:
        raise ValueError("Insufficient batch qty")
    batch.qty -= log.qty
    db.add(StockMovement(item_id=batch.item_id, batch_id=batch.id, qty_delta=-log.qty, reason="wastage", ref=str(log.id)))
    log.status = "approved"
    log.approved_by = approver_id
