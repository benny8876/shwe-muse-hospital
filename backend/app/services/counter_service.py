from datetime import datetime, timedelta

from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.models.accounting import Expense
from app.models.ancillary import LabOrder, RadiologyOrder
from app.models.billing import Invoice, InvoiceLine, Payment
from app.models.catalog import CatalogItem
from app.models.clinical import QueueToken, Visit
from app.models.ipd import Admission, Bed, Ward
from app.models.patients import Patient
from app.models.users import User
from app.services.billing_service import add_line, create_invoice, recalc_invoice
from app.services.inventory_service import dispense, stock_on_hand
from app.services.utils import audit, next_number


def get_open_invoice(db: Session, patient_id: int, branch_id: int, kind: str | None = None) -> Invoice | None:
    q = (
        db.query(Invoice)
        .filter(
            Invoice.patient_id == patient_id,
            Invoice.branch_id == branch_id,
            Invoice.status.in_(["draft", "open", "partial"]),
        )
    )
    if kind:
        q = q.filter(Invoice.kind == kind)
    return q.order_by(Invoice.id.desc()).first()


def reception_register(
    db: Session,
    *,
    branch_id: int,
    doctor_id: int,
    patient_id: int | None,
    name: str,
    phone: str,
    gender: str,
    user_id: int,
    patient_type: str = "opd",
    bed_id: int | None = None,
    deposit: float = 0,
    billing_mode: str = "daily",
    age_years: int | None = None,
    address: str = "",
    father_name: str = "",
    referring_doctor: str = "",
) -> dict:
    doctor = db.get(User, doctor_id)
    if not doctor or doctor.role != "doctor":
        raise ValueError("Doctor not found")

    if patient_id:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise ValueError("Patient not found")
    else:
        if not name.strip():
            raise ValueError("Patient name required")
        patient = Patient(
            uhid=next_number(db, "uhid", "ID-"),
            name=name.strip(),
            phone=phone,
            gender=gender,
            age_years=age_years,
            address=address,
            father_name=father_name.strip(),
            referring_doctor=referring_doctor,
        )
        db.add(patient)
        db.flush()

    ptype = (patient_type or "opd").lower()
    if ptype not in {"opd", "ipd"}:
        raise ValueError("Patient type must be OPD or IPD")

    if ptype == "ipd":
        return _register_ipd(
            db,
            branch_id=branch_id,
            patient=patient,
            doctor=doctor,
            bed_id=bed_id,
            deposit=deposit,
            billing_mode=billing_mode,
            user_id=user_id,
        )

    return _register_opd(db, branch_id=branch_id, patient=patient, doctor=doctor, user_id=user_id)


def _register_opd(db: Session, *, branch_id: int, patient: Patient, doctor: User, user_id: int) -> dict:
    token = QueueToken(
        branch_id=branch_id,
        department="OPD",
        patient_id=patient.id,
        number=next_number(db, "queue-OPD", "A-"),
    )
    db.add(token)

    inv = get_open_invoice(db, patient.id, branch_id, kind="opd")
    if not inv:
        inv = create_invoice(db, branch_id, patient.id, kind="opd", doctor_id=doctor.id)
    else:
        inv.doctor_id = doctor.id

    consult = db.query(CatalogItem).filter(CatalogItem.sku == "CONSULT").first()
    fee = doctor.consultation_fee or (consult.price if consult else 0)
    has_consult = any(l.source == "opd" and "Consultation" in (l.description or "") for l in inv.lines)
    if consult and not has_consult:
        add_line(
            db,
            inv,
            consult,
            1,
            fee,
            "opd",
            f"Consultation — {doctor.full_name}",
            doctor,
        )

    db.add(Visit(patient_id=patient.id, branch_id=branch_id, doctor_id=doctor.id))
    audit(db, user_id, "reception_register", "patient", str(patient.id), f"opd doctor={doctor.id} inv={inv.id}")
    db.flush()
    recalc_invoice(inv, db)
    return {
        "patient": patient,
        "invoice": inv,
        "token": token,
        "doctor": doctor,
        "patient_type": "opd",
        "admission": None,
        "bed": None,
        "ward": None,
    }


def _register_ipd(
    db: Session,
    *,
    branch_id: int,
    patient: Patient,
    doctor: User,
    bed_id: int | None,
    deposit: float,
    billing_mode: str,
    user_id: int,
) -> dict:
    if not bed_id:
        raise ValueError("Select ward bed for IPD admission")

    active = (
        db.query(Admission)
        .filter(
            Admission.patient_id == patient.id,
            Admission.branch_id == branch_id,
            Admission.status == "admitted",
        )
        .first()
    )
    if active:
        raise ValueError("Patient is already admitted to IPD")

    bed = db.get(Bed, bed_id)
    if not bed or bed.status != "available":
        raise ValueError("Bed not available")

    ward = db.get(Ward, bed.ward_id)
    if not ward or ward.branch_id != branch_id:
        raise ValueError("Invalid bed for this branch")

    bed.status = "occupied"
    adm = Admission(
        patient_id=patient.id,
        branch_id=branch_id,
        bed_id=bed.id,
        doctor_id=doctor.id,
        deposit=deposit,
        billing_mode=billing_mode or "daily",
    )
    db.add(adm)
    db.flush()

    inv = get_open_invoice(db, patient.id, branch_id, kind="ipd")
    if not inv:
        inv = create_invoice(db, branch_id, patient.id, kind="ipd", doctor_id=doctor.id)
    else:
        inv.doctor_id = doctor.id
    inv.admission_id = adm.id

    rate = bed.daily_rate
    if billing_mode == "hourly":
        rate = bed.hourly_rate
    elif billing_mode == "package":
        rate = bed.package_rate
    add_line(db, inv, None, 1, rate, "ipd_room", f"Room charge {bed.code} ({billing_mode})")

    if deposit > 0:
        from app.services.billing_service import pay_invoice

        pay_invoice(db, inv, "deposit", deposit, user_id, allow_overpay=True)

    audit(
        db,
        user_id,
        "ipd_admit",
        "admission",
        str(adm.id),
        f"patient={patient.id} bed={bed.code}",
    )
    db.flush()
    recalc_invoice(inv, db)
    return {
        "patient": patient,
        "invoice": inv,
        "token": None,
        "doctor": doctor,
        "patient_type": "ipd",
        "admission": adm,
        "bed": bed,
        "ward": ward,
    }


def pharmacy_charge(
    db: Session,
    *,
    branch_id: int,
    patient_id: int,
    item_id: int,
    warehouse_id: int,
    qty: float,
    user_id: int,
    prescription_item_id: int | None = None,
) -> dict:
    item = db.get(CatalogItem, item_id)
    if not item or not item.is_stock:
        raise ValueError("Medicine not found")

    inv = get_open_invoice(db, patient_id, branch_id)
    if not inv:
        raise ValueError("No open bill — patient must register at Reception first")

    picks = dispense(db, item, warehouse_id, qty, f"inv-{inv.id}", user_id)
    doctor = db.get(User, inv.doctor_id) if inv.doctor_id else None
    total_cost = sum(batch.unit_cost * take for batch, take in picks)
    avg_unit_cost = (total_cost / qty) if qty > 0 else 0
    if avg_unit_cost <= 0:
        avg_unit_cost = item.cost or 0
    primary_batch_id = picks[0][0].id if picks else None
    add_line(
        db,
        inv,
        item,
        qty,
        item.price,
        "pharmacy",
        item.name,
        doctor,
        batch_id=primary_batch_id,
        unit_cost=avg_unit_cost,
    )

    if prescription_item_id:
        from app.models.clinical import Prescription, PrescriptionItem

        rx_item = db.get(PrescriptionItem, prescription_item_id)
        if rx_item:
            rx_item.dispensed_qty = (rx_item.dispensed_qty or 0) + qty
            rx_item.status = "dispensed" if rx_item.dispensed_qty >= rx_item.qty else "partial"
            rx = db.get(Prescription, rx_item.prescription_id)
            if rx:
                statuses = {i.status for i in rx.items}
                rx.status = "dispensed" if statuses == {"dispensed"} else ("cancelled" if not statuses else "partial")

    audit(db, user_id, "pharmacy_dispense", "invoice", str(inv.id), f"item={item_id} qty={qty}")
    db.flush()
    recalc_invoice(inv, db)
    return {"invoice": inv, "item": item}


def pharmacy_walk_in_sale(db: Session, *, branch_id: int, name: str = "", phone: str = "", user_id: int) -> dict:
    """A walk-in customer buying medicine directly at Pharmacy without going
    through Reception first — creates a lightweight patient record and an
    open invoice (kind="pos") so the existing pharmacy_charge()/open-invoice
    billing path (POST /counter/pharmacy) can dispense to them exactly like a
    Reception-registered patient, no separate registration step needed."""
    patient = Patient(
        uhid=next_number(db, "uhid", "ID-"),
        name=name.strip() or "Walk-in Customer",
        phone=phone,
        gender="",
    )
    db.add(patient)
    db.flush()

    inv = create_invoice(db, branch_id, patient.id, kind="pos")
    db.flush()
    recalc_invoice(inv, db)

    audit(db, user_id, "pharmacy_walk_in_sale", "patient", str(patient.id), f"inv={inv.id}")
    return {"patient": patient, "invoice": inv}


def pending_prescriptions(db: Session, branch_id: int) -> list:
    from app.models.clinical import Prescription, PrescriptionItem

    rows = (
        db.query(Prescription)
        .filter(Prescription.branch_id == branch_id, Prescription.status.in_(["pending", "partial"]))
        .order_by(Prescription.id.desc())
        .limit(50)
        .all()
    )
    out = []
    for rx in rows:
        patient = db.get(Patient, rx.patient_id)
        doctor = db.get(User, rx.doctor_id) if rx.doctor_id else None
        items = [
            {
                "id": i.id,
                "catalog_item_id": i.catalog_item_id,
                "name": i.catalog_item.name if i.catalog_item else i.free_text_name,
                "qty": i.qty,
                "dispensed_qty": i.dispensed_qty,
                "dosage_instructions": i.dosage_instructions,
                "status": i.status,
            }
            for i in db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == rx.id).all()
            if i.status != "dispensed"
        ]
        if not items:
            continue
        out.append(
            {
                "prescription_id": rx.id,
                "patient_id": rx.patient_id,
                "patient_name": patient.name if patient else "—",
                "uhid": patient.uhid if patient else "—",
                "doctor_name": doctor.full_name if doctor else "—",
                "created_at": rx.created_at.isoformat() if rx.created_at else None,
                "items": items,
            }
        )
    return out


def doctor_examine(
    db: Session,
    *,
    branch_id: int,
    doctor_id: int,
    patient_id: int,
    chief_complaint: str,
    diagnosis: str,
    notes: str,
    follow_up_at,
    rx_items: list,
    user_id: int,
) -> dict:
    from app.models.clinical import Prescription, PrescriptionItem

    patient = db.get(Patient, patient_id)
    if not patient:
        raise ValueError("Patient not found")

    follow_up_dt = None
    if follow_up_at:
        follow_up_dt = follow_up_at if isinstance(follow_up_at, datetime) else datetime.fromisoformat(follow_up_at)

    # Reception creates an empty Visit stub at registration — reuse the latest
    # un-examined one for this patient/doctor instead of piling up duplicates.
    visit = (
        db.query(Visit)
        .filter(
            Visit.patient_id == patient_id,
            Visit.doctor_id == doctor_id,
            Visit.diagnosis == "",
            Visit.chief_complaint == "",
            Visit.notes == "",
        )
        .order_by(Visit.id.desc())
        .first()
    )
    if not visit:
        visit = Visit(patient_id=patient_id, branch_id=branch_id, doctor_id=doctor_id)
        db.add(visit)

    visit.chief_complaint = chief_complaint
    visit.diagnosis = diagnosis
    visit.notes = notes
    visit.follow_up_at = follow_up_dt
    db.flush()

    rx = None
    if rx_items:
        rx = Prescription(visit_id=visit.id, patient_id=patient_id, doctor_id=doctor_id, branch_id=branch_id)
        db.add(rx)
        db.flush()
        for line in rx_items:
            item_id = line.get("catalog_item_id") if isinstance(line, dict) else line.catalog_item_id
            free_text = line.get("free_text_name") if isinstance(line, dict) else line.free_text_name
            qty = line.get("qty") if isinstance(line, dict) else line.qty
            dosage = line.get("dosage_instructions") if isinstance(line, dict) else line.dosage_instructions
            if not item_id and not (free_text or "").strip():
                continue
            db.add(
                PrescriptionItem(
                    prescription_id=rx.id,
                    catalog_item_id=item_id,
                    free_text_name=free_text or "",
                    qty=qty or 1,
                    dosage_instructions=dosage or "",
                )
            )

    audit(db, user_id, "doctor_examine", "visit", str(visit.id), f"patient={patient_id}")
    db.flush()
    return {"visit": visit, "prescription": rx}


def lab_order(db: Session, *, branch_id: int, patient_id: int, item_id: int, user_id: int) -> dict:
    from app.models.ancillary import LabOrder

    item = db.get(CatalogItem, item_id)
    if not item or item.category != "lab":
        raise ValueError("Lab test not found")

    inv = get_open_invoice(db, patient_id, branch_id)
    if not inv:
        inv = create_invoice(db, branch_id, patient_id, kind="lab")

    doctor = db.get(User, inv.doctor_id) if inv.doctor_id else None
    add_line(db, inv, item, 1, item.price, "lab", item.name, doctor)
    order = LabOrder(
        patient_id=patient_id,
        branch_id=branch_id,
        doctor_id=inv.doctor_id,
        invoice_id=inv.id,
        tests=item.name,
        status="ordered",
        sample_id=next_number(db, "sample", "S-"),
    )
    db.add(order)
    audit(db, user_id, "lab_order", "invoice", str(inv.id), f"item={item_id}")
    db.flush()
    recalc_invoice(inv, db)
    return {"invoice": inv, "order": order, "item_name": item.name}


def lab_result(db: Session, *, order_id: int, result: str, user_id: int) -> dict:
    from app.models.ancillary import LabOrder

    order = db.get(LabOrder, order_id)
    if not order:
        raise ValueError("Lab order not found")
    order.result = result
    order.status = "completed"
    audit(db, user_id, "lab_result", "lab_order", str(order.id), "result entered")
    db.flush()

    patient = db.get(Patient, order.patient_id)
    doctor = db.get(User, order.doctor_id) if order.doctor_id else None
    return {
        "order_id": order.id,
        "patient_name": patient.name if patient else "—",
        "uhid": patient.uhid if patient else "—",
        "age_years": patient.age_years if patient else None,
        "gender": patient.gender if patient else "",
        "doctor_name": doctor.full_name if doctor else "",
        "tests": order.tests,
        "result": order.result,
        "status": order.status,
        "sample_id": order.sample_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


def usg_order(db: Session, *, branch_id: int, patient_id: int, item_id: int, user_id: int) -> dict:
    from app.models.ancillary import RadiologyOrder

    item = db.get(CatalogItem, item_id)
    if not item or item.category != "radiology" or item.department != "usg":
        raise ValueError("USG service not found")

    inv = get_open_invoice(db, patient_id, branch_id)
    if not inv:
        inv = create_invoice(db, branch_id, patient_id, kind="radiology")

    doctor = db.get(User, inv.doctor_id) if inv.doctor_id else None
    add_line(db, inv, item, 1, item.price, "radiology", item.name, doctor)
    order = RadiologyOrder(
        patient_id=patient_id,
        branch_id=branch_id,
        doctor_id=inv.doctor_id,
        modality="usg",
        invoice_id=inv.id,
        status="ordered",
    )
    db.add(order)
    audit(db, user_id, "usg_order", "invoice", str(inv.id), f"item={item_id}")
    db.flush()
    recalc_invoice(inv, db)
    return {"invoice": inv, "order": order, "item_name": item.name}


def radiology_result(db: Session, *, order_id: int, findings: str, user_id: int) -> dict:
    from app.models.ancillary import RadiologyOrder

    order = db.get(RadiologyOrder, order_id)
    if not order:
        raise ValueError("Order not found")
    order.findings = findings
    order.status = "completed"
    audit(db, user_id, "radiology_result", "radiology_order", str(order.id), "findings entered")
    db.flush()

    patient = db.get(Patient, order.patient_id)
    doctor = db.get(User, order.doctor_id) if order.doctor_id else None
    return {
        "order_id": order.id,
        "patient_name": patient.name if patient else "—",
        "uhid": patient.uhid if patient else "—",
        "age_years": patient.age_years if patient else None,
        "gender": patient.gender if patient else "",
        "doctor_name": doctor.full_name if doctor else "",
        "modality": order.modality,
        "findings": order.findings,
        "status": order.status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


def convert_patient_type(
    db: Session,
    *,
    branch_id: int,
    patient_id: int,
    target_type: str,
    doctor_id: int | None,
    bed_id: int | None,
    deposit: float,
    billing_mode: str,
    user_id: int,
) -> dict:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise ValueError("Patient not found")

    target = (target_type or "").lower()
    if target not in {"opd", "ipd"}:
        raise ValueError("target_type must be OPD or IPD")

    if target == "ipd":
        doctor = db.get(User, doctor_id) if doctor_id else None
        if not doctor:
            active_adm = (
                db.query(Admission)
                .filter(Admission.patient_id == patient_id, Admission.branch_id == branch_id)
                .order_by(Admission.id.desc())
                .first()
            )
            doctor = db.get(User, active_adm.doctor_id) if active_adm and active_adm.doctor_id else None
        if not doctor:
            raise ValueError("Doctor required to admit to IPD")
        return _register_ipd(
            db,
            branch_id=branch_id,
            patient=patient,
            doctor=doctor,
            bed_id=bed_id,
            deposit=deposit,
            billing_mode=billing_mode,
            user_id=user_id,
        )

    active = (
        db.query(Admission)
        .filter(Admission.patient_id == patient_id, Admission.branch_id == branch_id, Admission.status == "admitted")
        .first()
    )
    if not active:
        raise ValueError("Patient has no active IPD admission")
    active.status = "discharged"
    active.discharged_at = datetime.utcnow()
    if active.bed_id:
        bed = db.get(Bed, active.bed_id)
        if bed:
            bed.status = "available"

    doctor = db.get(User, active.doctor_id) if active.doctor_id else None
    if not doctor:
        raise ValueError("Doctor not found for this admission")

    audit(db, user_id, "convert_ipd_to_opd", "admission", str(active.id), f"patient={patient_id}")
    result = _register_opd(db, branch_id=branch_id, patient=patient, doctor=doctor, user_id=user_id)
    db.flush()
    return result


def xray_charge(db: Session, *, branch_id: int, patient_id: int, item_id: int, user_id: int) -> dict:
    item = db.get(CatalogItem, item_id)
    if not item or item.category != "radiology":
        raise ValueError("X-ray service not found")

    inv = get_open_invoice(db, patient_id, branch_id)
    if not inv:
        inv = create_invoice(db, branch_id, patient_id, kind="radiology")

    doctor = db.get(User, inv.doctor_id) if inv.doctor_id else None
    add_line(db, inv, item, 1, item.price, "radiology", item.name, doctor)
    order = RadiologyOrder(
        patient_id=patient_id,
        branch_id=branch_id,
        doctor_id=inv.doctor_id,
        modality=item.sku.lower(),
        invoice_id=inv.id,
        status="ordered",
    )
    db.add(order)
    audit(db, user_id, "xray_order", "invoice", str(inv.id), f"item={item_id}")
    db.flush()
    recalc_invoice(inv, db)
    return {"invoice": inv, "order": order, "item_name": item.name}


def apply_stock_count(db: Session, item_id: int, warehouse_id: int, counted_qty: float, user_id: int, notes: str = "") -> dict:
    from datetime import date

    from app.models.inventory import StockBatch, StockMovement

    current = stock_on_hand(db, item_id, warehouse_id)
    diff = counted_qty - current
    if diff == 0:
        return {"item_id": item_id, "system_qty": current, "counted_qty": counted_qty, "adjusted": 0}

    if diff > 0:
        batch = (
            db.query(StockBatch)
            .filter(StockBatch.item_id == item_id, StockBatch.warehouse_id == warehouse_id)
            .order_by(StockBatch.id.desc())
            .first()
        )
        if batch:
            batch.qty += diff
            batch_id = batch.id
        else:
            batch = StockBatch(
                item_id=item_id,
                warehouse_id=warehouse_id,
                batch_no="COUNT-ADJ",
                expiry_date=date.today().replace(year=date.today().year + 2),
                qty=diff,
                unit_cost=0,
            )
            db.add(batch)
            db.flush()
            batch_id = batch.id
        db.add(StockMovement(item_id=item_id, batch_id=batch_id, qty_delta=diff, reason="stock_count", ref=notes or "count+"))
    else:
        from app.services.inventory_service import pick_fefo

        picks = pick_fefo(db, item_id, warehouse_id, abs(diff))
        for batch, take in picks:
            db.add(StockMovement(item_id=item_id, batch_id=batch.id, qty_delta=-take, reason="stock_count", ref=notes or "count-"))

    audit(db, user_id, "stock_count", "catalog_item", str(item_id), f"counted={counted_qty} was={current}")
    return {"item_id": item_id, "system_qty": current, "counted_qty": counted_qty, "adjusted": diff}


PERIOD_LABELS = {"day": "Today", "month": "1 Month", "3m": "3 Months", "year": "1 Year"}

SOURCE_LABELS = {
    "opd": "Consultation",
    "pharmacy": "Pharmacy",
    "radiology": "X-Ray",
    "ipd_room": "IPD Room",
    "lab": "Lab",
}


def _period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "day":
        return datetime.combine(now.date(), datetime.min.time())
    days = {"month": 30, "3m": 90, "year": 365}.get(period, 30)
    return now - timedelta(days=days)


def cashier_analytics_range(db: Session, branch_id: int, date_from: datetime, date_to: datetime) -> dict:
    return _cashier_analytics_since(db, branch_id, since=date_from, until=date_to, period_label="Custom", period="custom")


def cashier_analytics(db: Session, branch_id: int, period: str = "month") -> dict:
    since = _period_start(period)
    return _cashier_analytics_since(db, branch_id, since=since, until=datetime.utcnow(), period_label=PERIOD_LABELS.get(period, period), period=period)


def _cashier_analytics_since(db: Session, branch_id: int, *, since: datetime, until: datetime, period_label: str, period: str) -> dict:
    pay_filter = (
        Invoice.branch_id == branch_id,
        Payment.created_at >= since,
        Payment.created_at <= until,
        Payment.method != "refund",
    )

    total_collected = float(
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice)
        .filter(*pay_filter)
        .scalar()
        or 0
    )
    collected_today_bills = float(
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice)
        .filter(
            Invoice.branch_id == branch_id,
            Payment.created_at >= since,
            Payment.created_at <= until,
            Payment.method != "refund",
            Invoice.created_at >= since,
            Invoice.created_at <= until,
        )
        .scalar()
        or 0
    )
    collected_older_bills = max(total_collected - collected_today_bills, 0)

    method_rows = (
        db.query(Payment.method, func.sum(Payment.amount))
        .join(Invoice)
        .filter(*pay_filter)
        .group_by(Payment.method)
        .order_by(func.sum(Payment.amount).desc())
        .all()
    )
    payment_methods = [{"method": str(r[0]).upper(), "amount": float(r[1] or 0)} for r in method_rows]

    total_bills = (
        db.query(Invoice)
        .filter(Invoice.branch_id == branch_id, Invoice.created_at >= since, Invoice.created_at <= until)
        .count()
    )
    paid_bills = (
        db.query(Invoice)
        .filter(
            Invoice.branch_id == branch_id,
            Invoice.created_at >= since,
            Invoice.created_at <= until,
            Invoice.status == "paid",
        )
        .count()
    )
    total_billed = float(
        db.query(func.coalesce(func.sum(Invoice.total), 0))
        .filter(Invoice.branch_id == branch_id, Invoice.created_at >= since, Invoice.created_at <= until)
        .scalar()
        or 0
    )
    outstanding = float(
        db.query(func.coalesce(func.sum(Invoice.balance), 0))
        .filter(
            Invoice.branch_id == branch_id,
            Invoice.created_at >= since,
            Invoice.created_at <= until,
            Invoice.status.in_(["open", "partial", "draft"]),
        )
        .scalar()
        or 0
    )

    source_rows = (
        db.query(InvoiceLine.source, func.sum(InvoiceLine.amount))
        .join(Invoice)
        .filter(Invoice.branch_id == branch_id, Invoice.created_at >= since, Invoice.created_at <= until)
        .group_by(InvoiceLine.source)
        .all()
    )
    by_source = [
        {"source": SOURCE_LABELS.get(str(r[0]), str(r[0] or "Other").title()), "amount": float(r[1] or 0)}
        for r in source_rows
        if float(r[1] or 0) > 0
    ]
    by_source.sort(key=lambda x: x["amount"], reverse=True)

    unit_cost_expr = case(
        (InvoiceLine.unit_cost > 0, InvoiceLine.unit_cost),
        else_=func.coalesce(CatalogItem.cost, 0),
    )
    pharmacy_row = (
        db.query(
            func.coalesce(func.sum(InvoiceLine.amount), 0),
            func.coalesce(func.sum(InvoiceLine.qty * unit_cost_expr), 0),
        )
        .outerjoin(CatalogItem, InvoiceLine.item_id == CatalogItem.id)
        .join(Invoice)
        .filter(
            Invoice.branch_id == branch_id,
            Invoice.created_at >= since,
            Invoice.created_at <= until,
            InvoiceLine.source == "pharmacy",
        )
        .first()
    )
    pharmacy_revenue = float(pharmacy_row[0] or 0) if pharmacy_row else 0
    pharmacy_cost = float(pharmacy_row[1] or 0) if pharmacy_row else 0
    pharmacy_profit = pharmacy_revenue - pharmacy_cost
    pharmacy_profit_data = {
        "revenue": pharmacy_revenue,
        "cost": pharmacy_cost,
        "profit": pharmacy_profit,
        "margin_pct": round(pharmacy_profit / pharmacy_revenue * 100, 1) if pharmacy_revenue > 0 else 0,
    }

    doctor_rows = (
        db.query(
            User.id,
            User.full_name,
            func.coalesce(func.sum(InvoiceLine.df_amount), 0),
            func.coalesce(func.sum(InvoiceLine.amount), 0),
            func.count(func.distinct(Invoice.id)),
        )
        .join(InvoiceLine, InvoiceLine.doctor_id == User.id)
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .filter(
            Invoice.branch_id == branch_id,
            Invoice.created_at >= since,
            Invoice.created_at <= until,
            User.role == "doctor",
        )
        .group_by(User.id, User.full_name)
        .having(func.coalesce(func.sum(InvoiceLine.df_amount), 0) > 0)
        .order_by(func.coalesce(func.sum(InvoiceLine.df_amount), 0).desc())
        .all()
    )
    by_doctor = [
        {
            "doctor_id": int(r[0]),
            "doctor": str(r[1]),
            "fee_income": float(r[2] or 0),
            "billed": float(r[3] or 0),
            "bills": int(r[4] or 0),
        }
        for r in doctor_rows
    ]

    total_expenses = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.branch_id == branch_id, Expense.created_at >= since, Expense.created_at <= until)
        .scalar()
        or 0
    )

    expense_cat_rows = (
        db.query(Expense.category, func.sum(Expense.amount), func.count(Expense.id))
        .filter(Expense.branch_id == branch_id, Expense.created_at >= since, Expense.created_at <= until)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    by_expense_category = [
        {
            "category": str(r[0] or "Uncategorized"),
            "amount": float(r[1] or 0),
            "count": int(r[2] or 0),
        }
        for r in expense_cat_rows
        if float(r[1] or 0) > 0
    ]

    expense_rows = (
        db.query(Expense)
        .filter(Expense.branch_id == branch_id, Expense.created_at >= since, Expense.created_at <= until)
        .order_by(Expense.created_at.desc())
        .limit(50)
        .all()
    )
    expense_details = [
        {
            "id": e.id,
            "category": e.category or "Uncategorized",
            "amount": float(e.amount or 0),
            "notes": e.notes or "",
            "paid_from": e.paid_from or "petty",
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in expense_rows
    ]

    if period == "day":
        trend_rows = (
            db.query(func.extract("hour", Payment.created_at), func.sum(Payment.amount))
            .join(Invoice)
            .filter(*pay_filter)
            .group_by(func.extract("hour", Payment.created_at))
            .order_by(func.extract("hour", Payment.created_at))
            .all()
        )
        trend = [{"label": f"{int(r[0]):02d}:00", "amount": float(r[1] or 0)} for r in trend_rows]
    else:
        trend_rows = (
            db.query(func.date(Payment.created_at), func.sum(Payment.amount))
            .join(Invoice)
            .filter(*pay_filter)
            .group_by(func.date(Payment.created_at))
            .order_by(func.date(Payment.created_at))
            .all()
        )
        trend = [{"label": str(r[0]), "amount": float(r[1] or 0)} for r in trend_rows]

    return {
        "period": period,
        "period_label": period_label,
        "from_date": since.date().isoformat(),
        "to_date": until.date().isoformat(),
        "total_collected": total_collected,
        "collected_today_bills": collected_today_bills,
        "collected_older_bills": collected_older_bills,
        "total_billed": total_billed,
        "total_expenses": total_expenses,
        "net": total_collected - total_expenses,
        "total_bills": total_bills,
        "paid_bills": paid_bills,
        "outstanding": outstanding,
        "avg_bill": round(total_collected / paid_bills) if paid_bills else 0,
        "payment_methods": payment_methods,
        "by_source": by_source,
        "pharmacy_profit": pharmacy_profit_data,
        "by_doctor": by_doctor,
        "by_expense_category": by_expense_category,
        "expense_details": expense_details,
        "trend": trend,
    }


def list_doctors(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == "doctor", User.is_active == True)  # noqa: E712
        .order_by(User.full_name)
        .all()
    )


def create_doctor(
    db: Session,
    *,
    full_name: str,
    consultation_fee: float,
    branch_id: int | None,
    specialty: str,
    user_id: int | None,
) -> User:
    name = full_name.strip()
    if not name:
        raise ValueError("Doctor name required")
    if consultation_fee < 0:
        raise ValueError("Fee cannot be negative")

    from app.core.security import hash_password

    username = next_number(db, "doc_user", "doc")
    while db.query(User).filter(User.username == username).first():
        username = next_number(db, "doc_user", "doc")

    doctor = User(
        username=username,
        hashed_password=hash_password("ShweMuse@123"),
        full_name=name,
        role="doctor",
        branch_id=branch_id,
        consultation_fee=consultation_fee,
        commission_pct=70,
        specialty=specialty.strip() or "General Medicine",
        department="opd",
    )
    db.add(doctor)
    db.flush()
    audit(db, user_id, "doctor_create", "user", str(doctor.id), f"{name} fee={consultation_fee}")
    return doctor


def update_doctor(
    db: Session,
    doctor_id: int,
    *,
    full_name: str | None,
    consultation_fee: float | None,
    specialty: str | None,
    user_id: int | None,
) -> User:
    doctor = db.get(User, doctor_id)
    if not doctor or doctor.role != "doctor":
        raise ValueError("Doctor not found")
    if full_name is not None:
        if not full_name.strip():
            raise ValueError("Doctor name required")
        doctor.full_name = full_name.strip()
    if consultation_fee is not None:
        if consultation_fee < 0:
            raise ValueError("Fee cannot be negative")
        doctor.consultation_fee = consultation_fee
    if specialty is not None:
        doctor.specialty = specialty.strip() or doctor.specialty
    audit(db, user_id, "doctor_update", "user", str(doctor.id), doctor.full_name)
    return doctor


SERVICE_DEPARTMENTS = {
    "lab": "lab",
    "xray": "radiology",
    "usg": "radiology",
}


def list_service_items(db: Session, department: str) -> list[CatalogItem]:
    category = SERVICE_DEPARTMENTS.get(department)
    if not category:
        raise ValueError("Invalid department")
    return (
        db.query(CatalogItem)
        .filter(CatalogItem.category == category, CatalogItem.department == department)
        .order_by(CatalogItem.name)
        .all()
    )


def create_service_item(db: Session, *, department: str, name: str, price: float, user_id: int | None) -> CatalogItem:
    category = SERVICE_DEPARTMENTS.get(department)
    if not category:
        raise ValueError("Invalid department")
    name = name.strip()
    if not name:
        raise ValueError("Name required")
    if price < 0:
        raise ValueError("Price cannot be negative")

    sku = next_number(db, f"svc_{department}", f"{department.upper()}-")
    item = CatalogItem(
        sku=sku,
        barcode=sku,
        name=name,
        name_mm=name,
        category=category,
        department=department,
        price=price,
        is_stock=False,
    )
    db.add(item)
    db.flush()
    audit(db, user_id, "service_item_create", "catalog_item", str(item.id), name)
    return item


def update_service_item(
    db: Session,
    item_id: int,
    *,
    name: str | None,
    price: float | None,
    is_active: bool | None,
    user_id: int | None,
) -> CatalogItem:
    item = db.get(CatalogItem, item_id)
    if not item or item.department not in SERVICE_DEPARTMENTS:
        raise ValueError("Service not found")
    if name is not None:
        if not name.strip():
            raise ValueError("Name required")
        item.name = name.strip()
        item.name_mm = item.name
    if price is not None:
        if price < 0:
            raise ValueError("Price cannot be negative")
        item.price = price
    if is_active is not None:
        item.is_active = is_active
    audit(db, user_id, "service_item_update", "catalog_item", str(item.id), item.name)
    return item


_SOURCE_LABELS = {
    "opd": "Consultation / OPD",
    "pharmacy": "Pharmacy",
    "radiology": "Radiology / X-ray",
    "lab": "Laboratory",
    "ipd_room": "IPD Room Charge",
}


def patient_medical_history(db: Session, *, patient_id: int, branch_id: int | None = None) -> dict:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise ValueError("Patient not found")

    inv_q = (
        db.query(Invoice)
        .options(joinedload(Invoice.lines))
        .filter(Invoice.patient_id == patient_id)
    )
    if branch_id:
        inv_q = inv_q.filter(Invoice.branch_id == branch_id)
    invoices = inv_q.order_by(Invoice.created_at.desc()).limit(200).all()

    clinical = (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.created_at.desc())
        .limit(200)
        .all()
    )

    doctor_ids = {inv.doctor_id for inv in invoices if inv.doctor_id}
    doctor_ids |= {v.doctor_id for v in clinical if v.doctor_id}
    doctors: dict[int, str] = {}
    if doctor_ids:
        doctors = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(doctor_ids)).all()}

    rad_by_inv: dict[int, list] = {}
    for order in (
        db.query(RadiologyOrder)
        .filter(RadiologyOrder.patient_id == patient_id)
        .order_by(RadiologyOrder.id)
        .all()
    ):
        if order.invoice_id:
            rad_by_inv.setdefault(order.invoice_id, []).append(order)
    lab_by_inv: dict[int, list] = {}
    for order in (
        db.query(LabOrder)
        .filter(LabOrder.patient_id == patient_id)
        .order_by(LabOrder.id)
        .all()
    ):
        if order.invoice_id:
            lab_by_inv.setdefault(order.invoice_id, []).append(order)

    visits_out = []
    for inv in invoices:
        by_source: dict[str, list[dict]] = {}
        for line in inv.lines:
            src = line.source or "other"
            by_source.setdefault(src, []).append({"description": line.description, "qty": line.qty, "source": src})
        treatments = [
            {
                "category": src,
                "label": _SOURCE_LABELS.get(src, src.replace("_", " ").title()),
                "items": items,
            }
            for src, items in by_source.items()
        ]
        rads = rad_by_inv.get(inv.id, [])
        labs = lab_by_inv.get(inv.id, [])
        visits_out.append(
            {
                "invoice_id": inv.id,
                "bill_number": inv.number,
                "visit_date": inv.created_at.isoformat() if inv.created_at else None,
                "type": inv.kind,
                "status": inv.status,
                "doctor_name": doctors.get(inv.doctor_id, "") if inv.doctor_id else "",
                "treatments": treatments,
                "radiology_findings": "\n\n".join(o.findings for o in rads if o.findings),
                "lab_result": "\n\n".join(o.result for o in labs if o.result),
                "lab_tests": ", ".join(o.tests for o in labs if o.tests),
                "lab_orders": [{"order_id": o.id, "tests": o.tests, "status": o.status} for o in labs],
                "radiology_orders": [{"order_id": o.id, "modality": o.modality, "status": o.status} for o in rads],
            }
        )

    clinical_notes = []
    for v in clinical:
        if not (v.diagnosis or v.chief_complaint or v.notes):
            continue
        clinical_notes.append(
            {
                "date": v.created_at.isoformat() if v.created_at else None,
                "doctor_name": doctors.get(v.doctor_id, "") if v.doctor_id else "",
                "chief_complaint": v.chief_complaint,
                "diagnosis": v.diagnosis,
                "notes": v.notes,
            }
        )

    return {"patient": patient, "visits": visits_out, "clinical_notes": clinical_notes}
