from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require
from app.db.session import get_db
from app.models.catalog import CatalogItem
from app.models.billing import Invoice
from app.models.ipd import Admission, WardMedOrder, WardMedOrderItem
from app.models.patients import Patient
from app.models.users import User
from app.schemas.actions import WardMedOrderIn
from app.services.counter_service import pharmacy_charge, resolve_open_invoice, resolve_ward_order_invoice
from app.services.utils import audit

router = APIRouter(prefix="/ward-orders", tags=["ward-orders"])


def _pin_invoice_id(db: Session, data: WardMedOrderIn) -> int | None:
    if data.invoice_id:
        try:
            inv = resolve_open_invoice(
                db,
                patient_id=data.patient_id,
                branch_id=data.branch_id,
                invoice_id=data.invoice_id,
                admission_id=data.admission_id,
            )
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        if data.admission_id and inv.admission_id != data.admission_id:
            raise HTTPException(400, "Bill does not match this admission")
        return inv.id
    if data.admission_id:
        adm = db.get(Admission, data.admission_id)
        if not adm or adm.patient_id != data.patient_id:
            raise HTTPException(400, "Admission not found for this patient")
        try:
            inv = resolve_open_invoice(
                db,
                patient_id=data.patient_id,
                branch_id=data.branch_id,
                admission_id=data.admission_id,
            )
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        return inv.id
    try:
        inv = resolve_open_invoice(db, patient_id=data.patient_id, branch_id=data.branch_id)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return inv.id


@router.post("")
def create_order(data: WardMedOrderIn, db: Session = Depends(get_db), user: User = Depends(require("nursing", "ipd"))):
    if not data.items:
        raise HTTPException(400, "Add at least one medicine")
    invoice_id = _pin_invoice_id(db, data)
    order = WardMedOrder(
        patient_id=data.patient_id,
        branch_id=data.branch_id,
        admission_id=data.admission_id,
        invoice_id=invoice_id,
        ordered_by=user.id,
        note=data.note,
    )
    db.add(order)
    db.flush()
    created_items = []
    for row in data.items:
        item = db.get(CatalogItem, row.item_id)
        if not item:
            raise HTTPException(400, f"Medicine {row.item_id} not found")
        order_item = WardMedOrderItem(order_id=order.id, catalog_item_id=row.item_id, qty=row.qty)
        db.add(order_item)
        created_items.append(order_item)
    audit(db, user.id, "ward_med_order_create", "ward_med_order", str(order.id), f"patient={data.patient_id} items={len(data.items)}")
    db.commit()
    return {
        "order_id": order.id,
        "items": [{"id": i.id, "item_id": i.catalog_item_id, "qty": i.qty, "status": i.status} for i in created_items],
    }


@router.get("/pending")
def pending_items(branch_id: int, db: Session = Depends(get_db), _: User = Depends(require("pharmacy", "dispense"))):
    """Flat list — one row per pending medicine — for Pharmacy's queue. Each
    row carries enough patient/nurse context to act on without a second call."""
    rows = (
        db.query(WardMedOrderItem, WardMedOrder, Patient, CatalogItem)
        .join(WardMedOrder, WardMedOrderItem.order_id == WardMedOrder.id)
        .join(Patient, WardMedOrder.patient_id == Patient.id)
        .join(CatalogItem, WardMedOrderItem.catalog_item_id == CatalogItem.id)
        .filter(WardMedOrder.branch_id == branch_id, WardMedOrderItem.status == "pending")
        .order_by(WardMedOrder.created_at.desc())
        .all()
    )
    out = []
    for item, order, patient, catalog_item in rows:
        nurse = db.get(User, order.ordered_by)
        visit_type = "IPD" if order.admission_id else "OPD"
        if order.invoice_id:
            inv = db.get(Invoice, order.invoice_id)
            if inv and inv.kind:
                visit_type = inv.kind.upper()
        out.append({
            "order_id": order.id,
            "order_item_id": item.id,
            "patient_id": patient.id,
            "patient_name": patient.name,
            "uhid": patient.uhid,
            "visit_type": visit_type,
            "invoice_id": order.invoice_id,
            "catalog_item_id": catalog_item.id,
            "medicine_name": catalog_item.name,
            "qty": item.qty,
            "note": order.note,
            "ordered_by_name": nurse.full_name if nurse else "",
            "created_at": order.created_at,
        })
    return out


@router.get("/patient/{patient_id}")
def patient_orders(patient_id: int, branch_id: int, db: Session = Depends(get_db), _: User = Depends(require("nursing", "ipd", "pharmacy"))):
    """A nurse's own view of what they've ordered for this patient, and
    whether Pharmacy has fulfilled it yet."""
    orders = (
        db.query(WardMedOrder)
        .options(joinedload(WardMedOrder.items).joinedload(WardMedOrderItem.catalog_item))
        .filter(WardMedOrder.patient_id == patient_id, WardMedOrder.branch_id == branch_id)
        .order_by(WardMedOrder.id.desc())
        .all()
    )
    out = []
    for order in orders:
        out.append({
            "order_id": order.id,
            "note": order.note,
            "created_at": order.created_at,
            "items": [
                {
                    "order_item_id": i.id,
                    "medicine_name": i.catalog_item.name if i.catalog_item else "",
                    "qty": i.qty,
                    "status": i.status,
                }
                for i in order.items
            ],
        })
    return out


@router.post("/items/{order_item_id}/dispense")
def dispense_item(order_item_id: int, warehouse_id: int, db: Session = Depends(get_db), user: User = Depends(require("pharmacy", "dispense"))):
    order_item = db.get(WardMedOrderItem, order_item_id)
    if not order_item or order_item.status != "pending":
        raise HTTPException(404, "Order item not found or already handled")
    order = db.get(WardMedOrder, order_item.order_id)
    try:
        inv = resolve_ward_order_invoice(db, order)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    try:
        result = pharmacy_charge(
            db,
            branch_id=order.branch_id,
            patient_id=order.patient_id,
            item_id=order_item.catalog_item_id,
            warehouse_id=warehouse_id,
            qty=order_item.qty,
            user_id=user.id,
            invoice_id=inv.id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    order_item.status = "dispensed"
    order_item.invoice_line_id = result["invoice"].lines[-1].id
    db.commit()
    return {"ok": True, "invoice_id": result["invoice"].id, "total": result["invoice"].total, "balance": result["invoice"].balance}


@router.post("/items/{order_item_id}/cancel")
def cancel_item(order_item_id: int, db: Session = Depends(get_db), user: User = Depends(require("pharmacy", "dispense", "nursing", "ipd"))):
    order_item = db.get(WardMedOrderItem, order_item_id)
    if not order_item or order_item.status != "pending":
        raise HTTPException(404, "Order item not found or already handled")
    order_item.status = "cancelled"
    audit(db, user.id, "ward_med_order_cancel", "ward_med_order_item", str(order_item.id))
    db.commit()
    return {"ok": True}
