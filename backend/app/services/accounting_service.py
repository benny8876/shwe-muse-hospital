from sqlalchemy.orm import Session

from app.models.accounting import JournalEntry, JournalLine, LedgerAccount
from app.models.billing import Invoice, Payment


def get_account(db: Session, code: str) -> LedgerAccount:
    acc = db.query(LedgerAccount).filter(LedgerAccount.code == code).first()
    if not acc:
        raise ValueError(f"Missing ledger account {code}")
    return acc


def post_entry(db: Session, ref: str, description: str, lines: list[tuple[str, float, float]]):
    entry = JournalEntry(ref=ref, description=description)
    db.add(entry)
    db.flush()
    for code, debit, credit in lines:
        acc = get_account(db, code)
        acc.balance += debit - credit
        db.add(JournalLine(entry_id=entry.id, account_id=acc.id, debit=debit, credit=credit))
    return entry


def post_payment(db: Session, inv: Invoice, payment: Payment):
    cash_codes = {
        "cash": "1000",
        "kpay": "1010",
        "wave": "1011",
        "kbzpay": "1012",
        "card": "1020",
        "deposit": "1100",
    }
    cash_code = cash_codes.get(payment.method, "1000")
    post_entry(
        db,
        ref=f"PAY-{payment.id}",
        description=f"Payment for {inv.number}",
        lines=[(cash_code, payment.amount, 0), ("4000", 0, payment.amount)],
    )


def post_expense(db: Session, category: str, amount: float, paid_from: str):
    expense_code = "5000"
    cash_code = "1000" if paid_from == "petty" else "1030"
    post_entry(
        db,
        ref=f"EXP-{category}",
        description=category,
        lines=[(expense_code, amount, 0), (cash_code, 0, amount)],
    )
