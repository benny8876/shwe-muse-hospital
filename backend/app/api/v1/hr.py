from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db.session import get_db
from app.models.org import AuditLog
from app.models.users import Attendance, Commission, DutyRoster, User
from app.models.users import User as UserModel

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/staff")
def staff(db: Session = Depends(get_db), _: User = Depends(require("hr", "staff"))):
    return db.query(UserModel).order_by(UserModel.id.asc()).all()


@router.post("/roster")
def add_roster(user_id: int, branch_id: int, work_date: date, shift: str, department: str = "", db: Session = Depends(get_db), _: User = Depends(require("roster", "hr"))):
    r = DutyRoster(user_id=user_id, branch_id=branch_id, work_date=work_date, shift=shift, department=department)
    db.add(r)
    db.commit()
    return r


@router.get("/roster")
def list_roster(work_date: date | None = None, db: Session = Depends(get_db), _: User = Depends(require("roster", "hr"))):
    q = db.query(DutyRoster)
    if work_date:
        q = q.filter(DutyRoster.work_date == work_date)
    return q.all()


@router.post("/attendance/check-in")
def check_in(user_id: int, db: Session = Depends(get_db), _: User = Depends(require("attendance", "hr"))):
    today = date.today()
    row = db.query(Attendance).filter(Attendance.user_id == user_id, Attendance.work_date == today).first()
    if not row:
        row = Attendance(user_id=user_id, work_date=today, check_in=datetime.utcnow())
        db.add(row)
    else:
        row.check_in = datetime.utcnow()
    db.commit()
    return row


@router.get("/commissions")
def commissions(db: Session = Depends(get_db), _: User = Depends(require("hr", "reports", "analytics"))):
    return db.query(Commission).order_by(Commission.id.desc()).limit(200).all()


@router.get("/audit")
def audit_logs(db: Session = Depends(get_db), _: User = Depends(require("hr"))):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).limit(200).all()
