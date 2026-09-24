from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ancillary import LabOrder, OTSchedule, RadiologyOrder, ServiceOrder
from app.models.billing import Invoice, InvoiceLine, Payment
from app.models.catalog import CatalogItem
from app.models.clinical import Appointment, QueueToken, Visit
from app.models.inventory import StockBatch, StockMovement
from app.models.ipd import Admission, Bed
from app.models.users import Commission, User
from app.services.inventory_service import alerts, stock_on_hand


def revenue_summary(db: Session, branch_id: int | None = None, days: int = 30):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(func.date(Payment.created_at), func.sum(Payment.amount)).filter(Payment.created_at >= since)
    if branch_id:
        q = q.join(Invoice).filter(Invoice.branch_id == branch_id)
    rows = q.group_by(func.date(Payment.created_at)).order_by(func.date(Payment.created_at)).all()
    daily = [{"date": str(d[0]), "amount": float(d[1] or 0)} for d in rows]
    total = sum(x["amount"] for x in daily)
    forecast = total / max(len(daily), 1) * 7 if daily else 0
    return {"daily": daily, "total": total, "forecast_next_7d": forecast}


def doctor_performance(db: Session, branch_id: int | None = None):
    q = db.query(User.full_name, func.sum(Commission.amount)).join(Commission, Commission.user_id == User.id)
    if branch_id:
        q = q.join(Invoice, Invoice.id == Commission.invoice_id).filter(Invoice.branch_id == branch_id)
    rows = q.group_by(User.id).all()
    return [{"doctor": r[0], "commission": float(r[1] or 0)} for r in rows]


def peak_hours(db: Session, branch_id: int | None = None):
    q = db.query(func.extract("hour", QueueToken.created_at), func.count()).filter(
        QueueToken.created_at >= datetime.utcnow() - timedelta(days=30)
    )
    if branch_id:
        q = q.filter(QueueToken.branch_id == branch_id)
    rows = q.group_by(func.extract("hour", QueueToken.created_at)).all()
    return [{"hour": int(r[0]), "count": int(r[1])} for r in rows]


def bed_occupancy(db: Session, branch_id: int | None = None):
    q = db.query(Bed.status, func.count()).join(Bed.ward)
    if branch_id:
        from app.models.ipd import Ward

        q = q.filter(Ward.branch_id == branch_id)
    rows = q.group_by(Bed.status).all()
    total = sum(r[1] for r in rows) or 1
    occupied = next((r[1] for r in rows if r[0] == "occupied"), 0)
    return {"total_beds": total, "occupied": occupied, "rate_pct": round(occupied / total * 100, 1)}


def reorder_suggestions(db: Session):
    items = db.query(CatalogItem).filter(CatalogItem.is_stock == True, CatalogItem.is_active == True).all()  # noqa: E712
    out = []
    for item in items:
        qty = stock_on_hand(db, item.id)
        if qty <= item.min_stock:
            out.append({"item_id": item.id, "name": item.name, "on_hand": qty, "suggest_qty": max(item.min_stock * 2 - qty, item.min_stock)})
    return out


def department_pl(db: Session, branch_id: int | None = None):
    q = db.query(InvoiceLine.source, func.sum(InvoiceLine.amount)).join(Invoice)
    if branch_id:
        q = q.filter(Invoice.branch_id == branch_id)
    rows = q.group_by(InvoiceLine.source).all()
    return [{"department": r[0], "revenue": float(r[1] or 0)} for r in rows]


def executive_kpi(db: Session, branch_id: int | None = None):
    rev = revenue_summary(db, branch_id)
    return {
        "revenue_30d": rev["total"],
        "forecast_7d": rev["forecast_next_7d"],
        "beds": bed_occupancy(db, branch_id),
        "inventory_alerts": alerts(db),
        "reorder": reorder_suggestions(db),
        "peak_hours": peak_hours(db, branch_id),
        "doctor_performance": doctor_performance(db, branch_id),
        "department_pl": department_pl(db, branch_id),
        "visits_today": db.query(Visit).filter(func.date(Visit.created_at) == datetime.utcnow().date()).count(),
        "appointments_today": db.query(Appointment).filter(func.date(Appointment.scheduled_at) == datetime.utcnow().date()).count(),
        "open_lab": db.query(LabOrder).filter(LabOrder.status != "billed").count(),
        "open_ot": db.query(OTSchedule).filter(OTSchedule.status != "done").count(),
    }
