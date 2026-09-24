from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db.session import get_db
from app.models.ancillary import LabOrder, RadiologyOrder
from app.models.billing import Invoice
from app.models.catalog import CatalogItem
from app.models.ipd import Admission, Bed, NursingNote, VitalSign, Ward
from app.models.patients import Patient
from app.models.users import User
from app.schemas.actions import AdmitIn, DischargeIn, NoteIn, TransferIn, VitalsIn
from app.services.billing_service import add_line, create_invoice, recalc_invoice

router = APIRouter(prefix="/ipd", tags=["ipd"])


@router.get("/dashboard")
def ipd_dashboard(branch_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "ipd.read", "nursing", "patients.read"))):
    wards = db.query(Ward).filter(Ward.branch_id == branch_id).order_by(Ward.name).all()
    out = []
    for ward in wards:
        beds = db.query(Bed).filter(Bed.ward_id == ward.id).order_by(Bed.code).all()
        bed_rows = []
        for bed in beds:
            admission_payload = None
            if bed.status == "occupied":
                adm = (
                    db.query(Admission)
                    .filter(Admission.bed_id == bed.id, Admission.status.in_(["admitted", "transferred"]))
                    .order_by(Admission.id.desc())
                    .first()
                )
                if adm:
                    patient = db.get(Patient, adm.patient_id)
                    inv = db.query(Invoice).filter(Invoice.admission_id == adm.id).order_by(Invoice.id.desc()).first()
                    lines_out = []
                    lab_orders_out = []
                    radiology_orders_out = []
                    if inv:
                        for line in inv.lines:
                            category = None
                            if line.item_id:
                                item = db.get(CatalogItem, line.item_id)
                                category = item.category if item else None
                            lines_out.append(
                                {
                                    "id": line.id,
                                    "description": line.description,
                                    "source": line.source,
                                    "category": category,
                                    "qty": line.qty,
                                    "unit_price": line.unit_price,
                                    "amount": line.amount,
                                }
                            )
                        lab_orders_out = [
                            {"order_id": o.id, "tests": o.tests, "status": o.status}
                            for o in db.query(LabOrder).filter(LabOrder.invoice_id == inv.id).order_by(LabOrder.id).all()
                        ]
                        radiology_orders_out = [
                            {"order_id": o.id, "modality": o.modality, "status": o.status}
                            for o in db.query(RadiologyOrder).filter(RadiologyOrder.invoice_id == inv.id).order_by(RadiologyOrder.id).all()
                        ]
                    admission_payload = {
                        "admission_id": adm.id,
                        "patient_id": adm.patient_id,
                        "patient_name": patient.name if patient else "",
                        "uhid": patient.uhid if patient else "",
                        "admitted_at": adm.admitted_at.isoformat() if adm.admitted_at else None,
                        "diagnosis": adm.diagnosis or "",
                        "billing_mode": adm.billing_mode,
                        "invoice_id": inv.id if inv else None,
                        "invoice_number": inv.number if inv else None,
                        "total": inv.total if inv else 0,
                        "subtotal": inv.subtotal if inv else 0,
                        "balance": inv.balance if inv else 0,
                        "deposit_paid": inv.paid if inv else 0,
                        "lines": lines_out,
                        "lab_orders": lab_orders_out,
                        "radiology_orders": radiology_orders_out,
                    }
            bed_rows.append(
                {
                    "id": bed.id,
                    "code": bed.code,
                    "status": bed.status,
                    "daily_rate": bed.daily_rate,
                    "hourly_rate": bed.hourly_rate,
                    "package_rate": bed.package_rate,
                    "admission": admission_payload,
                }
            )
        out.append(
            {
                "ward": {
                    "id": ward.id,
                    "name": ward.name,
                    "category": ward.category,
                    "floor": ward.floor,
                },
                "beds": bed_rows,
            }
        )
    return out


@router.get("/wards")
def wards(branch_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "ipd.read", "nursing"))):
    return db.query(Ward).filter(Ward.branch_id == branch_id).all()


@router.get("/beds")
def beds(ward_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("ipd", "ipd.read", "nursing"))):
    q = db.query(Bed)
    if ward_id:
        q = q.filter(Bed.ward_id == ward_id)
    return q.all()


@router.post("/admit")
def admit(data: AdmitIn, db: Session = Depends(get_db), _: User = Depends(require("ipd"))):
    bed = db.get(Bed, data.bed_id)
    if not bed or bed.status != "available":
        raise HTTPException(400, "Bed not available")
    bed.status = "occupied"
    adm = Admission(
        patient_id=data.patient_id,
        branch_id=data.branch_id,
        bed_id=data.bed_id,
        doctor_id=data.doctor_id,
        deposit=data.deposit,
        billing_mode=data.billing_mode,
    )
    db.add(adm)
    inv = create_invoice(db, data.branch_id, data.patient_id, kind="ipd", doctor_id=data.doctor_id)
    inv.admission_id = adm.id
    db.flush()
    if data.deposit > 0:
        from app.services.billing_service import pay_invoice

        pay_invoice(db, inv, "deposit", data.deposit, data.doctor_id or 1, allow_overpay=True)
    db.commit()
    db.refresh(adm)
    return {"admission": adm, "invoice_id": inv.id}


@router.post("/admissions/{admission_id}/transfer")
def transfer(admission_id: int, data: TransferIn, db: Session = Depends(get_db), _: User = Depends(require("ipd"))):
    adm = db.get(Admission, admission_id)
    new_bed = db.get(Bed, data.bed_id)
    if not adm or not new_bed or new_bed.status != "available":
        raise HTTPException(400)
    if adm.bed_id:
        old = db.get(Bed, adm.bed_id)
        if old:
            old.status = "available"
    new_bed.status = "occupied"
    adm.bed_id = data.bed_id
    adm.status = "transferred"
    db.commit()
    return adm


@router.post("/admissions/{admission_id}/daily-charge")
def daily_charge(admission_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "billing.create"))):
    adm = db.get(Admission, admission_id)
    if not adm or not adm.bed_id:
        raise HTTPException(404)
    bed = db.get(Bed, adm.bed_id)
    inv = db.query(Invoice).filter(Invoice.admission_id == admission_id, Invoice.kind == "ipd").first()
    if not inv:
        inv = create_invoice(db, adm.branch_id, adm.patient_id, kind="ipd", doctor_id=adm.doctor_id)
        inv.admission_id = admission_id
    rate = bed.daily_rate if adm.billing_mode == "daily" else bed.hourly_rate if adm.billing_mode == "hourly" else bed.package_rate
    add_line(db, inv, None, 1, rate, "ipd_room", f"Room charge {bed.code}")
    db.commit()
    return inv


@router.post("/admissions/{admission_id}/discharge")
def discharge(admission_id: int, data: DischargeIn, db: Session = Depends(get_db), _: User = Depends(require("ipd"))):
    adm = db.get(Admission, admission_id)
    if not adm:
        raise HTTPException(404)
    adm.status = "discharged"
    adm.discharged_at = datetime.utcnow()
    adm.discharge_summary = data.summary
    if adm.bed_id:
        bed = db.get(Bed, adm.bed_id)
        if bed:
            bed.status = "available"
    inv = db.query(Invoice).filter(Invoice.admission_id == admission_id).first()
    if inv:
        recalc_invoice(inv, db)
    db.commit()
    return adm


@router.get("/admissions")
def admissions(branch_id: int | None = None, status: str = "admitted", db: Session = Depends(get_db), _: User = Depends(require("ipd", "ipd.read", "nursing"))):
    q = db.query(Admission).filter(Admission.status == status)
    if branch_id:
        q = q.filter(Admission.branch_id == branch_id)
    return q.all()


@router.post("/admissions/{admission_id}/vitals")
def add_vitals(admission_id: int, data: VitalsIn, db: Session = Depends(get_db), _: User = Depends(require("vitals", "nursing"))):
    v = VitalSign(admission_id=admission_id, bp=data.bp, pulse=data.pulse, temp=data.temp, spo2=data.spo2, weight=data.weight)
    db.add(v)
    db.commit()
    return v


@router.post("/admissions/{admission_id}/notes")
def add_note(admission_id: int, data: NoteIn, db: Session = Depends(get_db), user: User = Depends(require("nursing"))):
    n = NursingNote(admission_id=admission_id, nurse_id=user.id, note=data.note)
    db.add(n)
    db.commit()
    return n


@router.get("/admissions/{admission_id}/vitals")
def list_vitals(admission_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "nursing"))):
    return db.query(VitalSign).filter(VitalSign.admission_id == admission_id).order_by(VitalSign.id.desc()).all()


@router.get("/admissions/{admission_id}/notes")
def list_notes(admission_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "nursing"))):
    return db.query(NursingNote).filter(NursingNote.admission_id == admission_id).order_by(NursingNote.id.desc()).all()


@router.get("/admissions/{admission_id}/bill")
def running_bill(admission_id: int, db: Session = Depends(get_db), _: User = Depends(require("ipd", "billing.read"))):
    inv = db.query(Invoice).filter(Invoice.admission_id == admission_id).first()
    if not inv:
        raise HTTPException(404)
    return inv
