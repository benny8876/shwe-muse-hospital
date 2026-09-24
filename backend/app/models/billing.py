from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CashierShift(Base):
    __tablename__ = "cashier_shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    opened_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    opening_float: Mapped[float] = mapped_column(Float, default=0)
    closing_cash: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default="open")
    notes: Mapped[str] = mapped_column(Text, default="")

    user = relationship("User")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    admission_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("cashier_shifts.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="opd")  # opd | ipd | pharmacy | other
    status: Mapped[str] = mapped_column(String(20), default="open")  # draft | open | partial | paid | void
    payer_type: Mapped[str] = mapped_column(String(20), default="self")  # self | corporate | insurance
    corporate_account_id: Mapped[int | None] = mapped_column(ForeignKey("corporate_accounts.id"), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="MMK")
    fx_rate: Mapped[float] = mapped_column(Float, default=1)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    paid: Mapped[float] = mapped_column(Float, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient")
    doctor = relationship("User")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    item_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_items.id"), nullable=True)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("stock_batches.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="opd")
    description: Mapped[str] = mapped_column(String(200), default="")
    qty: Mapped[float] = mapped_column(Float, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    amount: Mapped[float] = mapped_column(Float, default=0)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    df_amount: Mapped[float] = mapped_column(Float, default=0)

    invoice = relationship("Invoice", back_populates="lines")
    item = relationship("CatalogItem")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("cashier_shifts.id"), nullable=True)
    method: Mapped[str] = mapped_column(String(20))  # cash kpay wave kbzpay card deposit refund
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="MMK")
    fx_rate: Mapped[float] = mapped_column(Float, default=1)
    received_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
