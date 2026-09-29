"""Idempotent demo data: pharmacy stock + patient visit history."""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.db.pharmacy_medicines import MEDICINES
from app.models.ancillary import LabOrder, RadiologyOrder
from app.models.billing import Invoice
from app.models.catalog import CatalogItem
from app.models.clinical import Visit
from app.models.org import Branch, Setting, Warehouse
from app.models.patients import Patient
from app.models.users import User
from app.services.billing_service import add_line, create_invoice, pay_invoice, recalc_invoice
from app.services.inventory_service import create_medicine, receive_stock, stock_on_hand


def _item_by_sku(db: Session, sku: str) -> CatalogItem | None:
    return db.query(CatalogItem).filter(CatalogItem.sku == sku).first()


def ensure_pharmacy_demo_seed(db: Session) -> None:
    """Top up ~100 medicines with stock batches (skips existing SKUs)."""
    warehouse = db.query(Warehouse).filter(Warehouse.is_default.is_(True)).first()
    if not warehouse:
        warehouse = db.query(Warehouse).first()
    if not warehouse:
        return

    for sku, name, price in MEDICINES:
        existing = db.query(CatalogItem).filter(CatalogItem.sku == sku).first()
        if existing:
            item = existing
        else:
            item = create_medicine(
                db,
                name=name,
                sku=sku,
                barcode=sku,
                price=price,
                cost=round(price * 0.65, 2),
                min_stock=20,
                user_id=None,
            )

        if stock_on_hand(db, item.id, warehouse.id) < 10:
            qty = random.randint(80, 400)
            expiry = date.today() + timedelta(days=random.randint(180, 720))
            receive_stock(
                db,
                item_id=item.id,
                warehouse_id=warehouse.id,
                qty=qty,
                unit_cost=round(price * 0.65, 2),
                batch_no=f"DEMO-{sku}",
                expiry=expiry,
                user_id=None,
            )


def _add_visit_bundle(
    db: Session,
    *,
    branch: Branch,
    patient: Patient,
    doctor: User,
    cashier: User,
    days_ago: int,
    lines: list[tuple[str, float, str]],
    pay: bool | str = True,
    lab: list[tuple[str, str]] | None = None,
    radiology: list[tuple[str, str]] | None = None,
    clinical: dict | None = None,
) -> Invoice:
    """Create one historical invoice with optional lab/radiology orders and clinical note."""
    when = datetime.utcnow() - timedelta(days=days_ago)
    inv = create_invoice(db, branch.id, patient.id, kind="opd", doctor_id=doctor.id)
    inv.created_at = when

    for sku, qty, source in lines:
        item = _item_by_sku(db, sku)
        if not item:
            continue
        add_line(
            db,
            inv,
            item,
            qty,
            None,
            source,
            doctor=doctor if source == "opd" else None,
        )

    for tests, result in lab or []:
        order = LabOrder(
            patient_id=patient.id,
            branch_id=branch.id,
            doctor_id=doctor.id,
            invoice_id=inv.id,
            status="result",
            tests=tests,
            result=result,
            created_at=when + timedelta(hours=3),
        )
        db.add(order)

    for modality, findings in radiology or []:
        order = RadiologyOrder(
            patient_id=patient.id,
            branch_id=branch.id,
            doctor_id=doctor.id,
            invoice_id=inv.id,
            modality=modality,
            status="result",
            findings=findings,
            created_at=when + timedelta(hours=4),
        )
        db.add(order)

    if clinical:
        note = Visit(
            patient_id=patient.id,
            doctor_id=doctor.id,
            branch_id=branch.id,
            kind="opd",
            chief_complaint=clinical.get("chief_complaint", ""),
            diagnosis=clinical.get("diagnosis", ""),
            notes=clinical.get("notes", ""),
            created_at=when,
        )
        db.add(note)

    recalc_invoice(inv, db)
    if pay is True and inv.balance > 0.01:
        pay_invoice(db, inv, "cash", inv.balance, cashier.id)
    elif pay == "partial" and inv.balance > 0.01:
        pay_invoice(db, inv, "cash", round(inv.total * 0.5, 0), cashier.id)
    elif pay == "kpay" and inv.balance > 0.01:
        pay_invoice(db, inv, "kpay", inv.balance, cashier.id)

    return inv


def ensure_patient_history_demo_seed(db: Session) -> None:
    """Seed demo patients with multi-visit billing/lab/radiology history."""
    if db.query(Setting).filter(Setting.key == "demo_patient_history_seeded").first():
        return

    branch = db.query(Branch).first()
    if not branch:
        return

    doctor1 = db.query(User).filter(User.username == "doctor1").first()
    doctor2 = db.query(User).filter(User.username == "doctor2").first()
    cashier = db.query(User).filter(User.username == "cashier").first()
    if not doctor1 or not cashier:
        return

    # Enrich existing seed patients (Ma Thida, U Kyaw) if present
    thida = db.query(Patient).filter(Patient.phone == "09111111111").first()
    kyaw = db.query(Patient).filter(Patient.phone == "09222222222").first()

    new_patients = [
        ("DEMO-P003", "Daw Hla Hla", "ဒေါ်လှလှ", "F", date(1978, 3, 15), "09333333333", "", "B+"),
        ("DEMO-P004", "Ko Min Ko", "ကိုမင်းကို", "M", date(1995, 8, 22), "09444444444", "", "O+"),
        ("DEMO-P005", "Ma Su Su", "မစုစု", "F", date(2001, 11, 5), "09555555555", "Sulfa drugs", "A+"),
        ("DEMO-P006", "U Ba Tin", "ဦးဘာတင်", "M", date(1960, 1, 20), "09666666666", "Aspirin", "AB+"),
        ("DEMO-P007", "Ma Ei Ei", "မအိအိ", "F", date(1988, 7, 30), "09777777777", "", ""),
        ("DEMO-P008", "Ko Zaw Win", "ကိုဇော်ဝင်း", "M", date(1992, 4, 18), "09888888888", "", ""),
    ]

    for uhid, name, name_mm, gender, dob, phone, allergies, blood in new_patients:
        if not db.query(Patient).filter(Patient.uhid == uhid).first():
            db.add(
                Patient(
                    uhid=uhid,
                    name=name,
                    name_mm=name_mm,
                    gender=gender,
                    dob=dob,
                    birthday=dob,
                    phone=phone,
                    allergies=allergies,
                    blood_group=blood,
                    address="Yangon",
                )
            )
    db.flush()

    p_hla = db.query(Patient).filter(Patient.uhid == "DEMO-P003").first()
    p_min = db.query(Patient).filter(Patient.uhid == "DEMO-P004").first()
    p_su = db.query(Patient).filter(Patient.uhid == "DEMO-P005").first()
    p_ba = db.query(Patient).filter(Patient.uhid == "DEMO-P006").first()
    p_ei = db.query(Patient).filter(Patient.uhid == "DEMO-P007").first()
    p_zaw = db.query(Patient).filter(Patient.uhid == "DEMO-P008").first()

    doc_b = doctor2 or doctor1

    # Ma Thida — 3 past visits + 1 open visit today
    if thida:
        _add_visit_bundle(
            db, branch=branch, patient=thida, doctor=doctor1, cashier=cashier, days_ago=120,
            lines=[("CONSULT", 1, "opd"), ("LAB-CBC", 1, "lab")],
            pay=True,
            lab=[("CBC (Full Blood Count)", "Hb: 11.2 g/dL, WBC: 7,800, Platelets: 220,000")],
            clinical={"chief_complaint": "Fatigue, pale skin", "diagnosis": "Mild anemia", "notes": "Iron supplement advised"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=thida, doctor=doctor1, cashier=cashier, days_ago=75,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-001", 20, "pharmacy"),
                ("MED-021", 30, "pharmacy"),
                ("XRAY-CHEST", 1, "radiology"),
            ],
            pay="kpay",
            radiology=[("xray", "Heart size normal. Lung fields clear. No active lesion.")],
            clinical={"chief_complaint": "Cough 1 week", "diagnosis": "URTI", "notes": "Rest and fluids"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=thida, doctor=doc_b, cashier=cashier, days_ago=14,
            lines=[("CONSULT", 1, "opd"), ("USG-ABD", 1, "radiology")],
            pay=True,
            radiology=[("ultrasound", "Liver, spleen, kidneys normal. No free fluid.")],
            clinical={"chief_complaint": "Abdominal discomfort", "diagnosis": "Functional dyspepsia"},
        )
        open_inv = create_invoice(db, branch.id, thida.id, kind="opd", doctor_id=doctor1.id)
        consult = _item_by_sku(db, "CONSULT")
        if consult:
            add_line(db, open_inv, consult, 1, None, "opd", doctor=doctor1)

    # U Kyaw — hypertension follow-ups
    if kyaw:
        _add_visit_bundle(
            db, branch=branch, patient=kyaw, doctor=doc_b, cashier=cashier, days_ago=90,
            lines=[
                ("CONSULT", 1, "opd"),
                ("LAB-FBS", 1, "lab"),
                ("LAB-RFT", 1, "lab"),
                ("MED-049", 30, "pharmacy"),
                ("MED-061", 60, "pharmacy"),
            ],
            pay=True,
            lab=[
                ("Fasting Blood Sugar", "FBS: 118 mg/dL (borderline)"),
                ("Renal Function Test", "Creatinine: 0.9 mg/dL, Urea: 28 mg/dL — within normal limits"),
            ],
            clinical={"chief_complaint": "Routine DM/HTN check", "diagnosis": "Type 2 DM, Hypertension"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=kyaw, doctor=doc_b, cashier=cashier, days_ago=30,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-049", 30, "pharmacy"),
                ("MED-051", 30, "pharmacy"),
                ("MED-066", 30, "pharmacy"),
            ],
            pay=True,
            clinical={"chief_complaint": "BP follow-up", "diagnosis": "Hypertension — controlled", "notes": "Continue current meds"},
        )

    # Daw Hla Hla — respiratory + pharmacy heavy
    if p_hla:
        _add_visit_bundle(
            db, branch=branch, patient=p_hla, doctor=doctor1, cashier=cashier, days_ago=60,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-033", 1, "pharmacy"),
                ("MED-035", 20, "pharmacy"),
                ("MED-023", 10, "pharmacy"),
                ("XRAY-CHEST", 1, "radiology"),
            ],
            pay=True,
            radiology=[("xray", "Mild bronchial markings. No consolidation.")],
            clinical={"chief_complaint": "Wheezing, SOB", "diagnosis": "Bronchial asthma exacerbation"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=p_hla, doctor=doctor1, cashier=cashier, days_ago=10,
            lines=[("CONSULT", 1, "opd"), ("LAB-CBC", 1, "lab")],
            pay="partial",
            lab=[("CBC", "WBC: 9,200. Eosinophils mildly elevated.")],
        )

    # Ko Min Ko — infection + antibiotics
    if p_min:
        _add_visit_bundle(
            db, branch=branch, patient=p_min, doctor=doctor1, cashier=cashier, days_ago=45,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-003", 21, "pharmacy"),
                ("MED-008", 14, "pharmacy"),
                ("MED-001", 15, "pharmacy"),
            ],
            pay=True,
            clinical={"chief_complaint": "Fever, sore throat 3 days", "diagnosis": "Acute pharyngitis"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=p_min, doctor=doc_b, cashier=cashier, days_ago=20,
            lines=[("CONSULT", 1, "opd"), ("LAB-P01", 1, "lab")],
            pay=True,
            lab=[("General Physician Panel", "All parameters within reference range.")],
        )

    # Ma Su Su — OG / pregnancy related
    if p_su:
        _add_visit_bundle(
            db, branch=branch, patient=p_su, doctor=doc_b, cashier=cashier, days_ago=55,
            lines=[("CONSULT", 1, "opd"), ("USG-PREG", 1, "radiology"), ("LAB-P05", 1, "lab")],
            pay=True,
            lab=[("Beta hCG", "Positive — consistent with early pregnancy")],
            radiology=[("ultrasound", "Single intrauterine gestational sac. FHR positive.")],
            clinical={"chief_complaint": "Amenorrhea 8 weeks", "diagnosis": "Intrauterine pregnancy ~8 weeks"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=p_su, doctor=doc_b, cashier=cashier, days_ago=25,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-022", 30, "pharmacy"),
                ("MED-020", 30, "pharmacy"),
                ("USG-PREG", 1, "radiology"),
            ],
            pay=True,
            radiology=[("ultrasound", "Fetal biometry appropriate for dates. Normal liquor.")],
        )

    # U Ba Tin — cardiac workup
    if p_ba:
        _add_visit_bundle(
            db, branch=branch, patient=p_ba, doctor=doc_b, cashier=cashier, days_ago=100,
            lines=[
                ("CONSULT", 1, "opd"),
                ("LAB-LFT", 1, "lab"),
                ("LAB-CBC", 1, "lab"),
                ("MED-069", 30, "pharmacy"),
                ("MED-068", 30, "pharmacy"),
                ("MED-066", 30, "pharmacy"),
            ],
            pay=True,
            lab=[
                ("Liver Function Test", "ALT 32, AST 28 — normal"),
                ("CBC", "Hb 13.5, normal WBC count"),
            ],
            clinical={"chief_complaint": "Chest tightness on exertion", "diagnosis": "IHD — stable angina"},
        )
        _add_visit_bundle(
            db, branch=branch, patient=p_ba, doctor=doc_b, cashier=cashier, days_ago=40,
            lines=[("CONSULT", 1, "opd"), ("XRAY-CHEST", 1, "radiology")],
            pay=True,
            radiology=[("xray", "Cardiomegaly mild. Pulmonary congestion absent.")],
        )

    # Ma Ei Ei — GI issues
    if p_ei:
        _add_visit_bundle(
            db, branch=branch, patient=p_ei, doctor=doctor1, cashier=cashier, days_ago=35,
            lines=[
                ("CONSULT", 1, "opd"),
                ("MED-039", 14, "pharmacy"),
                ("MED-042", 10, "pharmacy"),
                ("USG-ABD", 1, "radiology"),
            ],
            pay=True,
            radiology=[("ultrasound", "Gallbladder normal. No cholelithiasis.")],
            clinical={"chief_complaint": "Epigastric pain, nausea", "diagnosis": "Gastritis"},
        )

    # Ko Zaw Win — open bill (for cashier/pharmacy active patient testing)
    if p_zaw:
        _add_visit_bundle(
            db, branch=branch, patient=p_zaw, doctor=doctor1, cashier=cashier, days_ago=50,
            lines=[("CONSULT", 1, "opd"), ("MED-082", 10, "pharmacy")],
            pay=True,
            clinical={"chief_complaint": "Back pain", "diagnosis": "Mechanical low back pain"},
        )
        open_inv = create_invoice(db, branch.id, p_zaw.id, kind="opd", doctor_id=doctor1.id)
        consult = _item_by_sku(db, "CONSULT")
        if consult:
            add_line(db, open_inv, consult, 1, None, "opd", doctor=doctor1)
        lab_item = _item_by_sku(db, "LAB-CBC")
        if lab_item:
            add_line(db, open_inv, lab_item, 1, None, "lab")
        med_item = _item_by_sku(db, "MED-005")
        if med_item:
            add_line(db, open_inv, med_item, 6, None, "pharmacy")

    db.add(Setting(key="demo_patient_history_seeded", value="true"))
    db.commit()


def ensure_demo_seed(db: Session) -> None:
    """Run all demo seed steps (pharmacy stock + patient history)."""
    ensure_pharmacy_demo_seed(db)
    ensure_patient_history_demo_seed(db)
    db.commit()
