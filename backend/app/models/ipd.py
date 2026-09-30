from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(20), default="general")  # general icu ccu vip private
    floor: Mapped[str] = mapped_column(String(20), default="")


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"))
    code: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="available")  # available occupied maintenance
    daily_rate: Mapped[float] = mapped_column(Float, default=0)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0)
    package_rate: Mapped[float] = mapped_column(Float, default=0)

    ward = relationship("Ward")


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    bed_id: Mapped[int | None] = mapped_column(ForeignKey("beds.id"), nullable=True)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="admitted")  # admitted transferred discharged
    admitted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deposit: Mapped[float] = mapped_column(Float, default=0)
    billing_mode: Mapped[str] = mapped_column(String(20), default="daily")  # daily hourly package
    diagnosis: Mapped[str] = mapped_column(Text, default="")
    discharge_summary: Mapped[str] = mapped_column(Text, default="")
    last_room_charge_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    patient = relationship("Patient")
    bed = relationship("Bed")
    doctor = relationship("User")


class NursingNote(Base):
    __tablename__ = "nursing_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(ForeignKey("admissions.id"))
    nurse_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    admission = relationship("Admission")


class VitalSign(Base):
    __tablename__ = "vital_signs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(ForeignKey("admissions.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    bp: Mapped[str] = mapped_column(String(20), default="")
    pulse: Mapped[str] = mapped_column(String(20), default="")
    temp: Mapped[str] = mapped_column(String(20), default="")
    spo2: Mapped[str] = mapped_column(String(20), default="")
    weight: Mapped[str] = mapped_column(String(20), default="")

    admission = relationship("Admission")


class WardMedOrder(Base):
    __tablename__ = "ward_med_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    admission_id: Mapped[int | None] = mapped_column(ForeignKey("admissions.id"), nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    ordered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient")
    admission = relationship("Admission")
    items = relationship("WardMedOrderItem", back_populates="order")


class WardMedOrderItem(Base):
    __tablename__ = "ward_med_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("ward_med_orders.id"))
    catalog_item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"))
    invoice_line_id: Mapped[int | None] = mapped_column(ForeignKey("invoice_lines.id"), nullable=True)
    qty: Mapped[float] = mapped_column(Float, default=1)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending dispensed cancelled

    order = relationship("WardMedOrder", back_populates="items")
    catalog_item = relationship("CatalogItem")
