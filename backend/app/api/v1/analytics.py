from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require
from app.db.session import get_db
from app.models.billing import Invoice
from app.models.clinical import Appointment, Visit
from app.models.comms import Campaign
from app.models.patients import Patient
from app.models.users import User
from app.services.analytics_service import bed_occupancy, department_pl, doctor_performance, executive_kpi, peak_hours, reorder_suggestions, revenue_summary
from app.services.sms_service import send_otp, send_sms, verify_otp

router = APIRouter(tags=["analytics"])


@router.get("/analytics/kpi")
def kpi(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("analytics", "kpi", "reports"))):
    return executive_kpi(db, branch_id)


@router.get("/analytics/revenue")
def revenue(branch_id: int | None = None, days: int = 30, db: Session = Depends(get_db), _: User = Depends(require("analytics", "reports"))):
    return revenue_summary(db, branch_id, days)


@router.get("/analytics/doctors")
def doctors(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("analytics", "reports"))):
    return doctor_performance(db, branch_id)


@router.get("/analytics/peak-hours")
def peaks(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("analytics", "reports"))):
    return peak_hours(db, branch_id)


@router.get("/analytics/beds")
def beds(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("analytics", "reports", "ipd.read"))):
    return bed_occupancy(db, branch_id)


@router.get("/analytics/reorder")
def reorder(db: Session = Depends(get_db), _: User = Depends(require("analytics", "inventory"))):
    return reorder_suggestions(db)


@router.get("/analytics/department-pl")
def dept_pl(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("analytics", "reports"))):
    return department_pl(db, branch_id)


@router.post("/comms/sms")
def sms(phone: str, message: str, kind: str = "general", db: Session = Depends(get_db), _: User = Depends(require("hr"))):
    log = send_sms(db, phone, message, kind)
    db.commit()
    return log


@router.post("/comms/campaigns")
def campaign(name: str, kind: str, message: str, db: Session = Depends(get_db), _: User = Depends(require("hr"))):
    c = Campaign(name=name, kind=kind, message=message, status="ready")
    db.add(c)
    db.commit()
    return c


@router.post("/portal/otp")
def portal_otp(phone: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.phone == phone).first()
    if not patient:
        return {"ok": False, "detail": "Patient not found"}
    send_otp(db, phone)
    db.commit()
    return {"ok": True}


@router.post("/portal/verify")
def portal_verify(phone: str, code: str, db: Session = Depends(get_db)):
    if not verify_otp(db, phone, code):
        return {"ok": False}
    patient = db.query(Patient).filter(Patient.phone == phone).first()
    db.commit()
    return {"ok": True, "patient_id": patient.id if patient else None}


@router.get("/portal/{patient_id}/bills")
def portal_bills(patient_id: int, phone: str, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient or patient.phone != phone:
        return []
    return db.query(Invoice).filter(Invoice.patient_id == patient_id).order_by(Invoice.id.desc()).limit(20).all()


@router.get("/portal/{patient_id}/history")
def portal_history(patient_id: int, phone: str, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient or patient.phone != phone:
        return []
    return db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.id.desc()).all()


@router.get("/portal/{patient_id}/appointments")
def portal_appointments(patient_id: int, phone: str, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient or patient.phone != phone:
        return []
    return db.query(Appointment).filter(Appointment.patient_id == patient_id).order_by(Appointment.scheduled_at.desc()).all()
