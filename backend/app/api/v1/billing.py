from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require
from app.db.session import get_db
from app.models.billing import CashierShift, Invoice
from app.models.catalog import CatalogItem, Promotion
from app.models.users import User
from app.models.billing import InvoiceLine
from app.schemas.actions import IpdDepositIn
from app.schemas.common import InvoiceCreateIn, InvoiceLineIn, InvoiceLineOut, InvoiceLineUpdateIn, InvoiceOut, MultiPaymentIn, PaymentIn, PharmacyLineIn, RefundIn
from app.services.billing_service import add_line, collect_ipd_deposit, create_invoice, pay_invoice, pay_invoice_multi, recalc_invoice, refund_payment, update_line, void_line
from app.services.counter_service import pharmacy_charge
from app.services.utils import audit

router = APIRouter(tags=["billing"])


@router.get("/catalog")
def catalog(q: str = "", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(CatalogItem).filter(CatalogItem.is_active == True)  # noqa: E712
    if q:
        like = f"%{q}%"
        query = query.filter((CatalogItem.name.ilike(like)) | (CatalogItem.barcode.ilike(like)) | (CatalogItem.sku.ilike(like)))
    return query.limit(100).all()


@router.get("/promotions")
def promotions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Promotion).filter(Promotion.is_active == True).all()  # noqa: E712


@router.post("/shifts/open")
def open_shift(branch_id: int, opening_float: float = 0, db: Session = Depends(get_db), user: User = Depends(require("shifts", "pos"))):
    existing = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    if existing:
        return existing
    s = CashierShift(user_id=user.id, branch_id=branch_id, opening_float=opening_float)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.post("/shifts/{shift_id}/close")
def close_shift(shift_id: int, closing_cash: float = 0, db: Session = Depends(get_db), user: User = Depends(require("shifts", "pos"))):
    s = db.get(CashierShift, shift_id)
    if not s or s.user_id != user.id:
        raise HTTPException(404)
    s.status = "closed"
    s.closing_cash = closing_cash
    s.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return s


@router.get("/shifts/current")
def current_shift(db: Session = Depends(get_db), user: User = Depends(require("pos", "shifts"))):
    return db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()


@router.get("/shifts/{shift_id}/z-report")
def z_report(shift_id: int, db: Session = Depends(get_db), _: User = Depends(require("shifts", "pos"))):
    # Based on Payment rows (which /invoices/{id}/pay, /pay-multi and /refund
    # already tag with the cashier's currently-open shift_id), not Invoice —
    # most invoices are created by Reception/IPD/Pharmacy via
    # billing_service.create_invoice() directly, never through this file's
    # POST /invoices, so Invoice.shift_id is essentially never set. Payments
    # collected while the till is open are the real per-shift signal.
    from app.models.accounting import Expense
    from app.models.billing import Payment

    payments = db.query(Payment).filter(Payment.shift_id == shift_id).all()
    collected = sum(p.amount for p in payments if p.method != "refund")
    refunded = sum(p.amount for p in payments if p.method == "refund")
    invoice_count = len({p.invoice_id for p in payments})
    expense_total = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(Expense.shift_id == shift_id).scalar() or 0
    )
    return {
        "shift_id": shift_id,
        "invoice_count": invoice_count,
        "collected": collected,
        "refunded": refunded,
        "net_collected": collected - refunded,
        "expense_total": expense_total,
    }


@router.post("/invoices", response_model=InvoiceOut)
def new_invoice(data: InvoiceCreateIn, db: Session = Depends(get_db), user: User = Depends(require("billing", "pos"))):
    shift = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    inv = create_invoice(db, data.branch_id, data.patient_id, data.kind, data.doctor_id)
    if shift:
        inv.shift_id = shift.id
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _: User = Depends(require("billing.read", "billing", "pos"))):
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404)
    return inv


@router.post("/invoices/{invoice_id}/lines", response_model=InvoiceLineOut)
def add_invoice_line(invoice_id: int, data: InvoiceLineIn, db: Session = Depends(get_db), user: User = Depends(require("billing", "pos"))):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404)
    item = db.get(CatalogItem, data.item_id) if data.item_id else None
    if item and item.is_stock:
        raise HTTPException(400, "Stock-tracked items must be added via /lines/pharmacy so stock is deducted")
    doctor = db.get(User, inv.doctor_id) if inv.doctor_id else None
    line = add_line(db, inv, item, data.qty, data.unit_price, data.source, data.description, doctor, data.discount)
    audit(db, user.id, "add_line", "invoice", str(inv.id))
    db.commit()
    return line


@router.post("/invoices/{invoice_id}/lines/pharmacy", response_model=InvoiceOut)
def add_invoice_pharmacy_line(
    invoice_id: int,
    data: PharmacyLineIn,
    db: Session = Depends(get_db),
    user: User = Depends(require("billing", "pos")),
):
    """Lets Cashier bill a stock-tracked (drug) item straight onto an already
    open bill — e.g. a missed item, or a patient buying medicine while
    settling up — without walking them to the Pharmacy counter first. Reuses
    pharmacy_charge() (the same dispense + add_line path Pharmacy's own Sale
    tab uses) so stock actually decrements instead of drifting out of sync
    with what physically left the shelf."""
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404)
    if not inv.patient_id:
        raise HTTPException(400, "Invoice has no patient to dispense against")
    try:
        pharmacy_charge(
            db,
            branch_id=inv.branch_id,
            patient_id=inv.patient_id,
            item_id=data.item_id,
            warehouse_id=data.warehouse_id,
            qty=data.qty,
            user_id=user.id,
            invoice_id=inv.id,
        )
        audit(db, user.id, "cashier_add_pharmacy_line", "invoice", str(inv.id), f"item={data.item_id} qty={data.qty}")
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return inv


@router.patch("/invoices/{invoice_id}/lines/{line_id}", response_model=InvoiceLineOut)
def edit_invoice_line(
    invoice_id: int,
    line_id: int,
    data: InvoiceLineUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require("billing", "pos")),
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    line = db.get(InvoiceLine, line_id)
    if not line or line.invoice_id != invoice_id:
        raise HTTPException(404, "Line not found")
    try:
        update_line(db, inv, line, unit_price=data.unit_price, qty=data.qty)
        audit(db, user.id, "edit_line", "invoice_line", str(line.id), f"price={data.unit_price} qty={data.qty}")
        db.commit()
        return line
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.delete("/invoices/{invoice_id}/lines/{line_id}", response_model=InvoiceOut)
def void_invoice_line(
    invoice_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require("billing", "pos")),
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    line = db.get(InvoiceLine, line_id)
    if not line or line.invoice_id != invoice_id:
        raise HTTPException(404, "Line not found")
    audit(db, user.id, "void_line", "invoice_line", str(line.id), f"{line.description} amount={line.amount}")
    void_line(db, inv, line)
    db.commit()
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return inv


@router.post("/invoices/{invoice_id}/discount", response_model=InvoiceOut)
def apply_discount(invoice_id: int, amount: float, db: Session = Depends(get_db), _: User = Depends(require("billing", "pos"))):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404)
    inv.discount = amount
    recalc_invoice(inv, db)
    db.commit()
    return inv


@router.post("/invoices/{invoice_id}/pay")
def pay(invoice_id: int, data: PaymentIn, db: Session = Depends(get_db), user: User = Depends(require("billing", "pos"))):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404)
    shift = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    try:
        p = pay_invoice(db, inv, data.method, data.amount, user.id, shift.id if shift else None)
        audit(db, user.id, "payment", "invoice", str(inv.id), data.method)
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return {"payment_id": p.id, "invoice": inv}


@router.post("/invoices/{invoice_id}/refund")
def refund(invoice_id: int, data: RefundIn, db: Session = Depends(get_db), user: User = Depends(require("billing", "pos"))):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404)
    shift = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    try:
        p = refund_payment(db, inv, amount=data.amount, user_id=user.id, method=data.method, reason=data.reason, shift_id=shift.id if shift else None)
        audit(db, user.id, "refund", "invoice", str(inv.id), f"{data.amount} {data.reason}".strip())
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return {"payment_id": p.id, "invoice": inv}


@router.post("/invoices/{invoice_id}/ipd-deposit", response_model=InvoiceOut)
def ipd_deposit_on_invoice(
    invoice_id: int,
    data: IpdDepositIn,
    db: Session = Depends(get_db),
    user: User = Depends(require("billing", "pos")),
):
    inv = db.get(Invoice, invoice_id)
    if not inv or inv.kind != "ipd" or not inv.admission_id:
        raise HTTPException(400, "Not an active IPD bill")
    shift = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    try:
        inv, _adm = collect_ipd_deposit(
            db,
            admission_id=inv.admission_id,
            amount=data.amount,
            method=data.method,
            user_id=user.id,
            shift_id=shift.id if shift else None,
        )
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return inv


@router.post("/invoices/{invoice_id}/pay-multi", response_model=InvoiceOut)
def pay_multi(invoice_id: int, data: MultiPaymentIn, db: Session = Depends(get_db), user: User = Depends(require("billing", "pos"))):
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404)
    shift = db.query(CashierShift).filter(CashierShift.user_id == user.id, CashierShift.status == "open").first()
    try:
        pay_invoice_multi(db, inv, data.payments, user.id, shift.id if shift else None)
        audit(db, user.id, "multi_payment", "invoice", str(inv.id), f"{len(data.payments)} splits")
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return inv


@router.get("/invoices")
def list_invoices(branch_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require("billing.read", "billing", "pos"))):
    q = db.query(Invoice)
    if branch_id:
        q = q.filter(Invoice.branch_id == branch_id)
    return q.order_by(Invoice.id.desc()).limit(100).all()
