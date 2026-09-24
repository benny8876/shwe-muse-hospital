from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    balance: Mapped[float] = mapped_column(Float, default=0)


class StockBatch(Base):
    __tablename__ = "stock_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"), index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    batch_no: Mapped[str] = mapped_column(String(60), index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    qty: Mapped[float] = mapped_column(Float, default=0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0)

    item = relationship("CatalogItem")
    warehouse = relationship("Warehouse")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("stock_batches.id"), nullable=True)
    qty_delta: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(30))  # purchase, sale, transfer, wastage, adjust, dispense
    ref: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | ordered | received
    total: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    supplier = relationship("Supplier")
    lines = relationship("PurchaseOrderLine", back_populates="po", cascade="all, delete-orphan")


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"))
    qty: Mapped[float] = mapped_column(Float, default=0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0)
    batch_no: Mapped[str] = mapped_column(String(60), default="")
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    po = relationship("PurchaseOrder", back_populates="lines")
    item = relationship("CatalogItem")


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    to_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("stock_batches.id"))
    qty: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="done")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class WastageLog(Base):
    __tablename__ = "wastage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("stock_batches.id"))
    qty: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(40))  # damaged | expired | other
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    batch = relationship("StockBatch")


class NarcoticLog(Base):
    __tablename__ = "narcotic_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("catalog_items.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("stock_batches.id"), nullable=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    qty: Mapped[float] = mapped_column(Float)
    direction: Mapped[str] = mapped_column(String(10))  # in | out
    witness: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    item = relationship("CatalogItem")
    patient = relationship("Patient")
