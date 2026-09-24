from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db.session import get_db
from app.models.ancillary import LabOrder, OTSchedule, RadiologyOrder, ServiceOrder
from app.models.catalog import CatalogItem
from app.schemas.actions import OTScheduleIn, RadiologyOrderIn
from app.schemas.common import LabOrderIn, ServiceOrderIn
from app.services.billing_service import add_line, create_invoice
from app.services.utils import next_number

router = APIRouter(prefix="/services", tags=["services"])


def _bill_service(db: Session, patient_id: int, branch_id: int, item_sku: str, source: str, doctor_id: int | None = None):
    item = db.query(CatalogItem).filter(CatalogItem.sku == item_sku).first()
    if not item:
        raise HTTPException(404, "Service item missing")
    inv = create_invoice(db, branch_id, patient_id, kind=source, doctor_id=doctor_id)
    add_line(db, inv, item, 1, item.price, source)
    db.flush()
    return inv


@router.post("/lab")
def lab_order(data: LabOrderIn, db: Session = Depends(get_db), _: User = Depends(require("lab", "billing.create"))):
    inv = _bill_service(db, data.patient_id, data.branch_id, "CBC", "lab", data.doctor_id)
    order = LabOrder(
        patient_id=data.patient_id,
        branch_id=data.branch_id,
        doctor_id=data.doctor_id,
        tests=data.tests,
        invoice_id=inv.id,
        sample_id=next_number(db, "sample", "S-"),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.patch("/lab/{order_id}")
def update_lab(order_id: int, status: str, result: str = "", db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    o = db.get(LabOrder, order_id)
    if not o:
        raise HTTPException(404)
    o.status = status
    if result:
        o.result = result
    db.commit()
    return o


@router.get("/lab")
def list_lab(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    q = db.query(LabOrder)
    if branch_id:
        q = q.filter(LabOrder.branch_id == branch_id)
    return q.order_by(LabOrder.id.desc()).limit(100).all()


@router.post("/radiology")
def radiology_order(data: RadiologyOrderIn, db: Session = Depends(get_db), _: User = Depends(require("radiology", "billing.create"))):
    inv = _bill_service(db, data.patient_id, data.branch_id, "XRAY", "radiology", data.doctor_id)
    order = RadiologyOrder(patient_id=data.patient_id, branch_id=data.branch_id, doctor_id=data.doctor_id, modality=data.modality, invoice_id=inv.id)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/radiology")
def list_radiology(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("radiology"))):
    q = db.query(RadiologyOrder)
    if branch_id:
        q = q.filter(RadiologyOrder.branch_id == branch_id)
    return q.order_by(RadiologyOrder.id.desc()).limit(100).all()


@router.post("/ot")
def schedule_ot(data: OTScheduleIn, db: Session = Depends(get_db), _: User = Depends(require("ot", "billing.create"))):
    inv = _bill_service(db, data.patient_id, data.branch_id, "OT-BASIC", "ot", data.surgeon_id)
    ot = OTSchedule(
        patient_id=data.patient_id,
        branch_id=data.branch_id,
        surgeon_id=data.surgeon_id,
        scheduled_at=data.scheduled_at,
        procedure=data.procedure,
        invoice_id=inv.id,
        surgeon_fee=150000,
        anesthesia_fee=50000,
        team_fee=30000,
    )
    db.add(ot)
    db.commit()
    db.refresh(ot)
    return ot


@router.get("/ot")
def list_ot(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("ot"))):
    q = db.query(OTSchedule)
    if branch_id:
        q = q.filter(OTSchedule.branch_id == branch_id)
    return q.order_by(OTSchedule.scheduled_at.asc()).limit(100).all()


@router.post("/extra")
def extra_service(data: ServiceOrderIn, db: Session = Depends(get_db), _: User = Depends(require("emergency", "billing.create"))):
    sku_map = {"dialysis": "DIALYSIS", "ambulance": "AMB", "emergency": "CONSULT", "physio": "CONSULT", "rehab": "CONSULT"}
    item_sku = data.sku or sku_map.get(data.service_type, "CONSULT")
    inv = _bill_service(db, data.patient_id, data.branch_id, item_sku, data.service_type)
    order = ServiceOrder(patient_id=data.patient_id, branch_id=data.branch_id, service_type=data.service_type, invoice_id=inv.id)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/extra")
def list_extra(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("emergency"))):
    q = db.query(ServiceOrder)
    if branch_id:
        q = q.filter(ServiceOrder.branch_id == branch_id)
    return q.order_by(ServiceOrder.id.desc()).limit(100).all()
