from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20))  # asset liability equity revenue expense
    balance: Mapped[float] = mapped_column(Float, default=0)


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ref: Mapped[str] = mapped_column(String(60), default="")
    description: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    account_id: Mapped[int] = mapped_column(ForeignKey("ledger_accounts.id"))
    debit: Mapped[float] = mapped_column(Float, default=0)
    credit: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="MMK")
    fx_rate: Mapped[float] = mapped_column(Float, default=1)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("LedgerAccount")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("cashier_shifts.id"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(60), default="")
    name: Mapped[str] = mapped_column(String(120), default="")
    amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="MMK")
    fx_rate: Mapped[float] = mapped_column(Float, default=1)
    paid_from: Mapped[str] = mapped_column(String(20), default="petty")  # petty cash bank
    paid_by: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    expense_date: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PettyCash(Base):
    __tablename__ = "petty_cash"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    balance: Mapped[float] = mapped_column(Float, default=0)
    last_topup: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CapitalAsset(Base):
    """A one-time, big-ticket equipment purchase (lab/X-ray machine, etc.) —
    deliberately separate from Expense, which is day-to-day operating spend.
    No depreciation schedule here on purpose (v1): Owner Panel just subtracts
    the lifetime total from net revenue for an "after equipment investment"
    figure, which is enough for an owner-level dashboard without turning this
    into full fixed-asset accounting."""

    __tablename__ = "capital_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60), default="")
    cost: Mapped[float] = mapped_column(Float, default=0)
    purchased_on: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SyncSnapshot(Base):
    """Latest rollup pushed from one branch's offline server — see
    scripts/push_sync.py and POST /sync/push. The cloud Admin Panel instance
    reads the latest snapshot per branch_code instead of trying to merge two
    branches' live Invoice/Payment tables (which would need to reconcile two
    separate primary-key spaces for no real benefit, since the owner only
    ever needs the rolled-up numbers, not line-level drill-down, from here)."""

    __tablename__ = "sync_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_code: Mapped[str] = mapped_column(String(20), index=True)
    period_label: Mapped[str] = mapped_column(String(40), default="")
    date_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payload: Mapped[str] = mapped_column(Text, default="")
    received_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
