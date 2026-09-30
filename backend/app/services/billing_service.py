from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.billing import Invoice, InvoiceLine, Payment
from app.models.catalog import CatalogItem
from app.models.ipd import Admission, Bed
from app.models.users import Commission, User
from app.services.accounting_service import post_payment, post_refund
from app.services.utils import next_number


def recalc_invoice(inv: Invoice, db: Session | None = None):
    if db is not None:
        inv.subtotal = float(
            db.query(func.coalesce(func.sum(InvoiceLine.amount), 0.0))
            .filter(InvoiceLine.invoice_id == inv.id)
            .scalar()
            or 0
        )
        has_lines = (
            db.query(func.count(InvoiceLine.id)).filter(InvoiceLine.invoice_id == inv.id).scalar() or 0
        ) > 0
        gross = float(
            db.query(func.coalesce(func.sum(Payment.amount), 0.0))
            .filter(Payment.invoice_id == inv.id, Payment.method != "refund")
            .scalar()
            or 0
        )
        refunded = float(
            db.query(func.coalesce(func.sum(Payment.amount), 0.0))
            .filter(Payment.invoice_id == inv.id, Payment.method == "refund")
            .scalar()
            or 0
        )
        inv.paid = max(gross - refunded, 0)
    else:
        inv.subtotal = sum(l.amount for l in inv.lines)
        has_lines = bool(inv.lines)
        gross = sum(p.amount for p in inv.payments if p.method != "refund")
        refunded = sum(p.amount for p in inv.payments if p.method == "refund")
        inv.paid = max(gross - refunded, 0)
    inv.total = max(inv.subtotal - inv.discount, 0)
    inv.balance = max(inv.total - inv.paid, 0)

    admission_ongoing = False
    if inv.admission_id and db is not None:
        admission = db.get(Admission, inv.admission_id)
        admission_ongoing = bool(admission and admission.status != "discharged")

    fully_discounted = has_lines and inv.total <= 0.01

    if inv.balance <= 0.01 and (inv.paid > 0.01 or fully_discounted) and not admission_ongoing:
        inv.status = "paid"
    elif inv.balance <= 0.01 and inv.total <= 0.01 and not has_lines:
        inv.status = "draft"
    elif inv.paid > 0:
        inv.status = "partial"
    else:
        inv.status = "open" if has_lines else "draft"


def add_line(
    db: Session,
    inv: Invoice,
    item: CatalogItem | None,
    qty: float,
    unit_price: float | None,
    source: str,
    description: str = "",
    doctor: User | None = None,
    discount: float = 0,
    batch_id: int | None = None,
    unit_cost: float = 0,
):
    price = unit_price if unit_price is not None else (item.price if item else 0)
    amount = max(qty * price - discount, 0)
    df_amount = 0.0
    doc_id = doctor.id if doctor else None
    if doctor and item and item.doctor_fee_pct:
        df_amount = amount * item.doctor_fee_pct / 100
    elif doctor and source == "opd" and doctor.consultation_fee:
        df_amount = doctor.consultation_fee
    line = InvoiceLine(
        invoice_id=inv.id,
        item_id=item.id if item else None,
        batch_id=batch_id,
        source=source,
        description=description or (item.name if item else ""),
        qty=qty,
        unit_price=price,
        unit_cost=unit_cost,
        discount=discount,
        amount=amount,
        doctor_id=doc_id,
        df_amount=df_amount,
    )
    inv.lines.append(line)
    db.flush()
    recalc_invoice(inv, db)
    if doctor and df_amount > 0:
        pct = doctor.commission_pct or 100
        db.add(Commission(user_id=doctor.id, invoice_id=inv.id, kind="doctor", amount=df_amount * pct / 100))
    return line


def update_line(db: Session, inv: Invoice, line: InvoiceLine, unit_price: float | None = None, qty: float | None = None) -> InvoiceLine:
    if unit_price is not None:
        if unit_price < 0:
            raise ValueError("Price cannot be negative")
        line.unit_price = unit_price
    if qty is not None:
        if qty <= 0:
            raise ValueError("Qty must be positive")
        line.qty = qty
    line.amount = max(line.qty * line.unit_price - line.discount, 0)
    if line.doctor_id and line.source == "opd" and line.df_amount > 0:
        line.df_amount = line.amount
    db.flush()
    recalc_invoice(inv, db)
    return line


def pay_invoice(db: Session, inv: Invoice, method: str, amount: float, user_id: int, shift_id: int | None = None, allow_overpay: bool = False):
    if amount <= 0:
        raise ValueError("Payment amount must be positive")
    recalc_invoice(inv, db)
    if not allow_overpay and amount > inv.balance + 0.01:
        raise ValueError(f"Amount exceeds balance ({inv.balance:.0f})")
    p = Payment(invoice_id=inv.id, shift_id=shift_id, method=method, amount=amount, received_by=user_id)
    inv.payments.append(p)
    db.flush()
    recalc_invoice(inv, db)
    post_payment(db, inv, p)
    return p


def refund_payment(
    db: Session,
    inv: Invoice,
    *,
    amount: float,
    user_id: int,
    method: str = "",
    reason: str = "",
    shift_id: int | None = None,
) -> Payment:
    """Records money paid back to the patient — a correction to an existing
    payment (wrong amount entered, cancelled service already paid for), not a
    new charge. Stored as its own Payment row (method="refund", amount kept
    positive like every other payment) rather than mutating the original
    payment, so both the original collection and the refund stay visible in
    the invoice's payment history."""
    if amount <= 0:
        raise ValueError("Refund amount must be positive")
    recalc_invoice(inv, db)
    if amount > inv.paid + 0.01:
        raise ValueError(f"Refund cannot exceed amount paid ({inv.paid:.0f})")
    p = Payment(invoice_id=inv.id, shift_id=shift_id, method="refund", amount=amount, received_by=user_id, notes=reason)
    inv.payments.append(p)
    db.flush()
    recalc_invoice(inv, db)
    post_refund(db, inv, p, method or "cash")
    return p


def void_line(db: Session, inv: Invoice, line: InvoiceLine) -> None:
    """Removes a wrongly-billed line entirely (not a soft-delete — there's no
    voided/status column on InvoiceLine) and recalculates the invoice. Doctor
    commission tied to this line (Commission has no line_id, only
    invoice_id) is deliberately left untouched rather than guessed at —
    reversing it correctly would need a per-line link that doesn't exist."""
    inv.lines.remove(line)
    db.delete(line)
    db.flush()
    recalc_invoice(inv, db)


def pay_invoice_multi(db: Session, inv: Invoice, payments: list, user_id: int, shift_id: int | None = None):
    if not payments:
        raise ValueError("Add at least one payment")
    recalc_invoice(inv, db)
    total = sum(float(p.amount) for p in payments)
    if total <= 0:
        raise ValueError("Invalid payment total")
    if total > inv.balance + 0.01:
        raise ValueError(f"Payment total exceeds balance ({inv.balance:.0f})")
    created = []
    for p in payments:
        amt = float(p.amount)
        if amt <= 0:
            continue
        created.append(pay_invoice(db, inv, p.method, amt, user_id, shift_id))
    return created


IPD_DEPOSIT_METHODS = frozenset({"deposit", "cash", "kpay", "wave", "kbzpay", "card"})


def collect_ipd_deposit(
    db: Session,
    *,
    admission_id: int,
    amount: float,
    method: str,
    user_id: int,
    shift_id: int | None = None,
) -> tuple[Invoice, Admission]:
    from app.services.utils import audit

    adm = db.get(Admission, admission_id)
    if not adm:
        raise ValueError("Admission not found")
    if adm.status not in ("admitted", "transferred"):
        raise ValueError("Patient is not an active IPD admission")
    m = (method or "deposit").lower()
    if m not in IPD_DEPOSIT_METHODS:
        raise ValueError("Invalid payment method for IPD deposit")
    inv = db.query(Invoice).filter(Invoice.admission_id == admission_id, Invoice.kind == "ipd").order_by(Invoice.id.desc()).first()
    if not inv:
        raise ValueError("No IPD invoice for this admission")
    pay_invoice(db, inv, m, float(amount), user_id, shift_id, allow_overpay=True)
    adm.deposit = float(adm.deposit or 0) + float(amount)
    audit(db, user_id, "ipd_deposit", "admission", str(admission_id), f"{m} amount={amount}")
    db.flush()
    return inv, adm


def ensure_daily_room_charges(db: Session, adm: Admission) -> int:
    """Catches up any room-charge days owed since `last_room_charge_date`,
    so ward staff no longer have to remember to click "Post room charge"
    every day. There's no background job runner in this codebase, so this
    is called opportunistically wherever an active admission is read (IPD
    dashboard, admissions list, discharge) rather than on a schedule.
    Idempotent per calendar day: advances `last_room_charge_date` to today,
    so calling it again the same day is a no-op. Only `billing_mode ==
    "daily"` accrues this way — "package" is a single flat fee already
    posted at admission, and "hourly" isn't billed per calendar day.
    Returns the number of days charged."""
    if adm.status not in ("admitted", "transferred") or not adm.bed_id or adm.billing_mode != "daily":
        return 0
    today = date.today()
    last = adm.last_room_charge_date or (adm.admitted_at.date() if adm.admitted_at else today)
    days_owed = (today - last).days
    if days_owed <= 0:
        return 0
    bed = db.get(Bed, adm.bed_id)
    inv = db.query(Invoice).filter(Invoice.admission_id == adm.id, Invoice.kind == "ipd").order_by(Invoice.id.desc()).first()
    if not bed or not inv:
        return 0
    label = f"Room charge {bed.code} ({adm.billing_mode})"
    for _ in range(days_owed):
        add_line(db, inv, None, 1, bed.daily_rate, "ipd_room", label)
    adm.last_room_charge_date = today
    db.flush()
    return days_owed


def create_invoice(db: Session, branch_id: int, patient_id: int | None, kind: str = "opd", doctor_id: int | None = None):
    inv = Invoice(
        number=next_number(db, "invoice", "INV-"),
        patient_id=patient_id,
        branch_id=branch_id,
        doctor_id=doctor_id,
        kind=kind,
    )
    db.add(inv)
    db.flush()
    return inv
