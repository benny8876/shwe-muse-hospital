from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CorporateAccount(Base):
    __tablename__ = "corporate_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(30), default="corporate")  # corporate | insurance
    contact: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    credit_limit: Mapped[float] = mapped_column(Float, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uhid: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    name_mm: Mapped[str] = mapped_column(String(160), default="")
    father_name: Mapped[str] = mapped_column(String(160), default="")
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(10), default="")
    phone: Mapped[str] = mapped_column(String(40), index=True, default="")
    nrc: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    referring_doctor: Mapped[str] = mapped_column(String(160), default="")
    blood_group: Mapped[str] = mapped_column(String(8), default="")
    allergies: Mapped[str] = mapped_column(Text, default="")
    corporate_account_id: Mapped[int | None] = mapped_column(ForeignKey("corporate_accounts.id"), nullable=True)
    insurance_name: Mapped[str] = mapped_column(String(120), default="")
    insurance_no: Mapped[str] = mapped_column(String(80), default="")
    family_head_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    portal_pin: Mapped[str] = mapped_column(String(20), default="")
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    corporate = relationship("CorporateAccount")
    family_head = relationship("Patient", remote_side="Patient.id")
