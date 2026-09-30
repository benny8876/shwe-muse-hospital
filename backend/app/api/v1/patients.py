import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require
from app.db.session import get_db
from app.models.billing import Invoice
from app.models.clinical import Appointment, QueueToken, Visit
from app.models.org import Branch
from app.models.patients import Patient
from app.models.users import User
from app.schemas.actions import AppointmentIn, AppointmentUpdateIn
from app.schemas.common import AppointmentOut, PatientIn, PatientOut, QueueIn, VisitIn
from app.services.utils import next_number, next_uhid

APPOINTMENT_STATUSES = {"booked", "arrived", "done", "cancelled"}


def _check_appointment_conflict(
    db: Session,
    *,
    doctor_id: int,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_id: int | None = None,
) -> None:
    """Two active (non-cancelled) appointments for the same doctor must not overlap in time."""
    from datetime import timedelta

    start = scheduled_at
    end = scheduled_at + timedelta(minutes=duration_minutes)
    q = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status != "cancelled",
    )
    if exclude_id:
        q = q.filter(Appointment.id != exclude_id)
    for other in q.all():
        other_start = other.scheduled_at
        other_end = other.scheduled_at + timedelta(minutes=other.duration_minutes or 15)
        if start < other_end and other_start < end:
            raise ValueError(f"Doctor already has an appointment at {other_start.strftime('%H:%M')}")

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
    p = Patient(uhid=next_uhid(db), **data.model_dump())
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
def doctors(specialty: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(User).filter(User.role == "doctor", User.is_active == True)  # noqa: E712
    if specialty and specialty.strip():
        q = q.filter(User.specialty == specialty.strip())
    return q.order_by(User.full_name).all()


@router.post("/appointments", response_model=AppointmentOut)
def create_appointment(data: AppointmentIn, db: Session = Depends(get_db), _: User = Depends(require("appointments"))):
    if not db.get(Patient, data.patient_id):
        raise HTTPException(404, "Patient not found")
    doctor = db.get(User, data.doctor_id)
    if not doctor or doctor.role != "doctor":
        raise HTTPException(404, "Doctor not found")
    try:
        _check_appointment_conflict(
            db,
            doctor_id=data.doctor_id,
            scheduled_at=data.scheduled_at,
            duration_minutes=data.duration_minutes,
        )
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    ap = Appointment(
        patient_id=data.patient_id,
        doctor_id=data.doctor_id,
        branch_id=data.branch_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        source=data.source,
        notes=data.notes,
    )
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    branch_id: int | None = None,
    doctor_id: int | None = None,
    status: str = "",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Appointment)
    if branch_id:
        q = q.filter(Appointment.branch_id == branch_id)
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if status.strip():
        q = q.filter(Appointment.status == status.strip())
    if date_from:
        q = q.filter(Appointment.scheduled_at >= date_from)
    if date_to:
        q = q.filter(Appointment.scheduled_at <= date_to)
    return q.order_by(Appointment.scheduled_at.asc()).limit(200).all()


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    data: AppointmentUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require("appointments")),
):
    ap = db.get(Appointment, appointment_id)
    if not ap:
        raise HTTPException(404, "Appointment not found")
    if data.status is not None:
        if data.status not in APPOINTMENT_STATUSES:
            raise HTTPException(400, f"Status must be one of {sorted(APPOINTMENT_STATUSES)}")
        ap.status = data.status
    if data.notes is not None:
        ap.notes = data.notes
    reschedule = data.scheduled_at is not None or data.doctor_id is not None or data.duration_minutes is not None
    if reschedule:
        next_doctor_id = data.doctor_id if data.doctor_id is not None else ap.doctor_id
        next_scheduled_at = data.scheduled_at if data.scheduled_at is not None else ap.scheduled_at
        next_duration = data.duration_minutes if data.duration_minutes is not None else ap.duration_minutes
        try:
            _check_appointment_conflict(
                db,
                doctor_id=next_doctor_id,
                scheduled_at=next_scheduled_at,
                duration_minutes=next_duration,
                exclude_id=ap.id,
            )
        except ValueError as e:
            raise HTTPException(409, str(e)) from e
        ap.doctor_id = next_doctor_id
        ap.scheduled_at = next_scheduled_at
        ap.duration_minutes = next_duration
    db.commit()
    db.refresh(ap)
    return ap


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
    db.refresh(t)
    return t


@router.patch("/queue/{token_id}/done")
def finish_queue(token_id: int, db: Session = Depends(get_db), _: User = Depends(require("queue"))):
    t = db.get(QueueToken, token_id)
    if not t:
        raise HTTPException(404)
    t.status = "done"
    db.commit()
    db.refresh(t)
    return t


@router.patch("/queue/{token_id}/skip")
def skip_queue(token_id: int, db: Session = Depends(get_db), _: User = Depends(require("queue"))):
    t = db.get(QueueToken, token_id)
    if not t:
        raise HTTPException(404)
    t.status = "skipped"
    db.commit()
    db.refresh(t)
    return t


@router.get("/queue-dashboard")
def queue_dashboard(branch_id: int, department: str = "OPD", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Live waiting-room view: every waiting/serving token, who's assigned to
    which doctor (via the patient's open OPD invoice, since the token itself
    doesn't carry a doctor), and how long they've been waiting — plus a
    per-doctor summary so Reception can see where the backlog is."""
    tokens = (
        db.query(QueueToken)
        .filter(
            QueueToken.branch_id == branch_id,
            QueueToken.department == department,
            QueueToken.status.in_(["waiting", "serving"]),
        )
        .order_by(QueueToken.id.asc())
        .all()
    )
    now = datetime.utcnow()
    rows = []
    by_doctor: dict[str, dict] = {}
    for t in tokens:
        patient = db.get(Patient, t.patient_id) if t.patient_id else None
        inv = (
            db.query(Invoice)
            .filter(
                Invoice.patient_id == t.patient_id,
                Invoice.branch_id == branch_id,
                Invoice.kind == "opd",
                Invoice.status.in_(["draft", "open", "partial"]),
            )
            .order_by(Invoice.id.desc())
            .first()
            if t.patient_id
            else None
        )
        doctor = db.get(User, inv.doctor_id) if inv and inv.doctor_id else None
        doctor_name = doctor.full_name if doctor else "Unassigned"
        waited_seconds = int((now - t.created_at).total_seconds()) if t.created_at else 0
        rows.append({
            "token_id": t.id,
            "number": t.number,
            "patient_id": t.patient_id,
            "patient_name": patient.name if patient else "",
            "uhid": patient.uhid if patient else "",
            "doctor_id": doctor.id if doctor else None,
            "doctor_name": doctor_name,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "called_at": t.called_at.isoformat() if t.called_at else None,
            "waited_seconds": waited_seconds,
        })
        bucket = by_doctor.setdefault(doctor_name, {"doctor_name": doctor_name, "waiting": 0, "serving": 0, "wait_seconds_total": 0, "wait_count": 0})
        if t.status == "waiting":
            bucket["waiting"] += 1
            bucket["wait_seconds_total"] += waited_seconds
            bucket["wait_count"] += 1
        elif t.status == "serving":
            bucket["serving"] += 1

    summary = [
        {
            "doctor_name": b["doctor_name"],
            "waiting": b["waiting"],
            "serving": b["serving"],
            "avg_wait_seconds": int(b["wait_seconds_total"] / b["wait_count"]) if b["wait_count"] else 0,
        }
        for b in sorted(by_doctor.values(), key=lambda b: -b["waiting"])
    ]
    return {"tokens": rows, "by_doctor": summary}


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
