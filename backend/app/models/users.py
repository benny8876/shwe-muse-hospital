from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40), index=True)
    department: Mapped[str] = mapped_column(String(60), default="")
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    employee_code: Mapped[str] = mapped_column(String(40), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    specialty: Mapped[str] = mapped_column(String(80), default="")
    consultation_fee: Mapped[float] = mapped_column(Float, default=0)
    commission_pct: Mapped[float] = mapped_column(Float, default=0)
    is_external: Mapped[bool] = mapped_column(Boolean, default=False)
    license_no: Mapped[str] = mapped_column(String(60), default="")
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    allowed_counters: Mapped[str] = mapped_column(Text, default="")
    extra_permissions: Mapped[str] = mapped_column(Text, default="")
    allowed_features: Mapped[str] = mapped_column(Text, default="")

    branch = relationship("Branch")


class DutyRoster(Base):
    __tablename__ = "duty_rosters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    work_date: Mapped[date] = mapped_column(Date, index=True)
    shift: Mapped[str] = mapped_column(String(20))  # morning, evening, night
    department: Mapped[str] = mapped_column(String(60), default="")
    notes: Mapped[str] = mapped_column(String(200), default="")

    user = relationship("User")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    work_date: Mapped[date] = mapped_column(Date, index=True)
    check_in: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    check_out: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="present")

    user = relationship("User")


class Commission(Base):
    __tablename__ = "commissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="doctor")  # doctor | nurse
    amount: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User")
