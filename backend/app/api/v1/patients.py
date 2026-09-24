import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require
from app.db.session import get_db
from app.models.clinical import Appointment, QueueToken, Visit
from app.models.org import Branch
from app.models.patients import Patient
from app.models.users import User
from app.schemas.common import PatientIn, PatientOut, QueueIn, VisitIn
from app.services.utils import next_number

router = APIRouter(tags=["patients"])


@router.get("/branches")
def branches(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Branch).filter(Branch.is_active == True).all()  # noqa: E712


@router.get("/patients", response_model=list[PatientOut])
def list_patients(q: str = "", db: Session = Depends(get_db), _: User = Depends(require("patients", "patients.read"))):
    query = db.query(Patient)
    for term in re.split(r"[,\s]+", q.strip()):
        if not term:
            continue
        like = f"%{term}%"
        query = query.filter(
            (Patient.name.ilike(like))
            | (Patient.name_mm.ilike(like))
            | (Patient.uhid.ilike(like))
            | (Patient.father_name.ilike(like))
            | (Patient.phone.ilike(like))
        )
    return query.order_by(Patient.id.desc()).limit(50).all()


@router.post("/patients", response_model=PatientOut)
def create_patient(data: PatientIn, db: Session = Depends(get_db), _: User = Depends(require("patients"))):
    p = Patient(uhid=next_number(db, "uhid", "ID-"), **data.model_dump())
    if data.dob:
        from datetime import date

        p.dob = date.fromisoformat(data.dob)
        p.birthday = p.dob
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require("patients.read"))):
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(404)
    return p


@router.get("/doctors")
def doctors(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(User).filter(User.role == "doctor", User.is_active == True).all()  # noqa: E712


@router.post("/appointments")
def create_appointment(
    patient_id: int,
    doctor_id: int,
    branch_id: int,
    scheduled_at: datetime,
    source: str = "counter",
    db: Session = Depends(get_db),
    _: User = Depends(require("appointments")),
):
    ap = Appointment(patient_id=patient_id, doctor_id=doctor_id, branch_id=branch_id, scheduled_at=scheduled_at, source=source)
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.get("/appointments")
def list_appointments(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Appointment)
    if branch_id:
        q = q.filter(Appointment.branch_id == branch_id)
    return q.order_by(Appointment.scheduled_at.desc()).limit(100).all()


@router.post("/queue")
def create_queue(data: QueueIn, db: Session = Depends(get_db), _: User = Depends(require("queue"))):
    token = QueueToken(
        branch_id=data.branch_id,
        department=data.department,
        patient_id=data.patient_id,
        number=next_number(db, f"queue-{data.department}", f"{data.department[:1]}-"),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


@router.get("/queue")
def list_queue(branch_id: int, department: str = "OPD", db: Session = Depends(get_db)):
    return (
        db.query(QueueToken)
        .filter(QueueToken.branch_id == branch_id, QueueToken.department == department, QueueToken.status.in_(["waiting", "serving"]))
        .order_by(QueueToken.id.asc())
        .all()
    )


@router.patch("/queue/{token_id}/call")
def call_queue(token_id: int, db: Session = Depends(get_db), _: User = Depends(require("queue"))):
    t = db.get(QueueToken, token_id)
    if not t:
        raise HTTPException(404)
    t.status = "serving"
    t.called_at = datetime.utcnow()
    db.commit()
    return t


@router.post("/visits")
def create_visit(data: VisitIn, db: Session = Depends(get_db), _: User = Depends(require("opd", "emr"))):
    v = Visit(
        patient_id=data.patient_id,
        branch_id=data.branch_id,
        doctor_id=data.doctor_id,
        diagnosis=data.diagnosis,
        prescription=data.prescription,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.get("/visits")
def list_visits(
    patient_id: int | None = None,
    doctor_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Visit)
    if patient_id:
        q = q.filter(Visit.patient_id == patient_id)
    if doctor_id:
        q = q.filter(Visit.doctor_id == doctor_id)
    return q.order_by(Visit.id.desc()).limit(100).all()
