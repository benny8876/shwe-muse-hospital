from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ordered")
    # ordered collected in_lab result billed
    sample_id: Mapped[str] = mapped_column(String(30), default="")
    tests: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient")


class RadiologyOrder(Base):
    __tablename__ = "radiology_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    modality: Mapped[str] = mapped_column(String(30), default="xray")  # xray ct ultrasound
    status: Mapped[str] = mapped_column(String(20), default="ordered")
    findings: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient")


class OTSchedule(Base):
    __tablename__ = "ot_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    surgeon_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)
    procedure: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    anesthesia_fee: Mapped[float] = mapped_column(Float, default=0)
    surgeon_fee: Mapped[float] = mapped_column(Float, default=0)
    team_fee: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")

    patient = relationship("Patient")


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    service_type: Mapped[str] = mapped_column(String(30))  # dialysis physio rehab ambulance emergency
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient")
