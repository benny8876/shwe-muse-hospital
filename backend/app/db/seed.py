from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.accounting import LedgerAccount, PettyCash
from app.models.catalog import CatalogItem, LabTestReagent, Promotion
from app.models.clinical import Appointment, QueueToken
from app.models.inventory import StockBatch, Supplier
from app.models.ipd import Bed, Ward
from app.models.org import Branch, Sequence, Setting, Warehouse
from app.models.patients import CorporateAccount, Patient
from app.models.users import User
from app.services.utils import next_number

# The 16 structured lab report panels the hospital's printed A4 templates cover
# (frontend/src/lib/labTemplates.ts renders the matching structured result-entry
# form and print layout for a lab order whose item name matches one of these).
LAB_PANEL_ITEMS = [
    ("LAB-P01", "General Physician Panel", 45000),
    ("LAB-P02", "OG Panel", 20000),
    ("LAB-P03", "BCRVD Screening (HBsAg, HCV, HIV, VDRL)", 15000),
    ("LAB-P04", "ABO and Rh Blood Grouping", 5000),
    ("LAB-P05", "Beta hCG", 12000),
    ("LAB-P06", "Urine Routine Examination", 6000),
    ("LAB-P07", "Blood Donor Issue Form", 10000),
    ("LAB-P08", "RPR Dilution (VDRL Titre)", 8000),
    ("LAB-P09", "Widal Test", 10000),
    ("LAB-P10", "Semen Analysis", 15000),
    ("LAB-P11", "Sputum and Stool AFB", 9000),
    ("LAB-P12", "Stool Routine Examination", 6000),
    ("LAB-P13", "ADA (Adenosine Deaminase)", 10000),
    ("LAB-P14", "Urine Albumin Creatinine Ratio (UACR)", 12000),
    ("LAB-P15", "Urine Protein Creatinine Ratio (UPCR)", 12000),
    ("LAB-P16", "Blood Film Report", 8000),
]


def seed(db: Session):
    if db.query(Branch).first():
        return

    main = Branch(code="MAIN", name="Shwe Muse Hospital", name_mm="ရွှေမူး ဆေးရုံ", is_main=True, phone="09-123456789")
    db.add(main)
    db.flush()
    wh = Warehouse(branch_id=main.id, name="Main Pharmacy Store", is_default=True)
    db.add(wh)
    db.flush()

    accounts = [
        ("1000", "Cash", "asset"),
        ("1010", "KPay", "asset"),
        ("1011", "Wave", "asset"),
        ("1012", "KBZPay", "asset"),
        ("1020", "Card Clearing", "asset"),
        ("1030", "Bank", "asset"),
        ("1100", "Patient Deposits", "liability"),
        ("2000", "Accounts Payable", "liability"),
        ("3000", "Equity", "equity"),
        ("4000", "Patient Revenue", "revenue"),
        ("5000", "Operating Expense", "expense"),
    ]
    for code, name, kind in accounts:
        db.add(LedgerAccount(code=code, name=name, kind=kind))
    db.add(PettyCash(branch_id=main.id, balance=500000))

    users = [
        ("admin", "super_admin", "System Admin", 0, 0),
        ("cashier", "cashier", "Cashier One", 0, 0),
        ("receptionist", "receptionist", "Reception", 0, 0),
        ("doctor1", "doctor", "Dr. Aung Kyaw", 10000, 70),
        ("doctor2", "doctor", "Dr. Su Mon", 15000, 70),
        ("doctor3", "doctor", "Dr. Min Htet", 20000, 70),
        ("pharmacy", "pharmacist", "Pharmacist Hla", 0, 0),
        ("xray", "radiology", "X-ray Staff", 0, 0),
        ("usg", "usg", "USG Staff", 0, 0),
        ("lab", "lab_tech", "Lab Tech Aye", 0, 0),
        ("nurse", "nurse", "Nurse Khin", 0, 0),
        ("warehouse", "warehouse", "Store Keeper Zaw", 0, 0),
    ]
    pw = hash_password("ShweMuse@123")
    doctor_user = None
    for username, role, name, fee, pct in users:
        u = User(
            username=username,
            hashed_password=pw,
            full_name=name,
            role=role,
            branch_id=main.id,
            consultation_fee=fee,
            commission_pct=pct,
            specialty="General Medicine" if role == "doctor" else "",
        )
        db.add(u)
        if username == "doctor1":
            doctor_user = u
    db.flush()

    corp = CorporateAccount(name="ABC Company", kind="corporate", contact="HR", phone="09-999")
    db.add(corp)
    db.flush()

    p1 = Patient(
        uhid=next_number(db, "uhid", "ID-"),
        name="Ma Thida",
        name_mm="မသီတာ",
        phone="09111111111",
        gender="F",
        dob=date(1990, 5, 12),
        birthday=date(1990, 5, 12),
        allergies="Penicillin",
        portal_pin="1111",
    )
    p2 = Patient(
        uhid=next_number(db, "uhid", "ID-"),
        name="U Kyaw",
        name_mm="ဦးကျော်",
        phone="09222222222",
        gender="M",
        dob=date(1985, 1, 3),
        birthday=date(1985, 1, 3),
    )
    db.add_all([p1, p2])
    db.flush()

    items = [
        ("CONSULT", "OPD Consultation", "consultation", 10000, False, 0),
        ("PARA500", "Paracetamol 500mg", "drug", 500, True, 100),
        ("AMOX500", "Amoxicillin 500mg", "drug", 1500, True, 50),
        ("ORS", "ORS Sachet", "drug", 300, True, 200),
        ("XRAY-CHEST", "Chest X-Ray", "radiology", 20000, False, 0),
        ("XRAY-LIMB", "Limb X-Ray", "radiology", 15000, False, 0),
        ("XRAY-ABD", "Abdominal X-Ray", "radiology", 25000, False, 0),
        ("XRAY-SKULL", "Skull X-Ray", "radiology", 30000, False, 0),
    ]
    for sku, name, cat, price, stock, min_s in items:
        db.add(
            CatalogItem(
                sku=sku,
                barcode=sku,
                name=name,
                name_mm=name,
                category=cat,
                department="xray" if cat == "radiology" else cat,
                price=price,
                cost=price * 0.6,
                is_stock=stock,
                min_stock=min_s,
                doctor_fee_pct=100 if cat == "consultation" else 0,
            )
        )

    usg_items = [
        ("USG-ABD", "Abdominal Ultrasound", 25000),
        ("USG-PREG", "Pregnancy Ultrasound", 30000),
        ("USG-PELVIS", "Pelvis Ultrasound", 25000),
    ]
    for sku, name, price in usg_items:
        db.add(
            CatalogItem(
                sku=sku,
                barcode=sku,
                name=name,
                name_mm=name,
                category="radiology",
                department="usg",
                price=price,
                cost=price * 0.6,
            )
        )

    lab_items = [
        ("LAB-CBC", "CBC (Full Blood Count)", 8000),
        ("LAB-FBS", "Fasting Blood Sugar", 5000),
        ("LAB-LFT", "Liver Function Test", 15000),
        ("LAB-RFT", "Renal Function Test", 15000),
        ("LAB-UA", "Urine Analysis", 4000),
    ] + LAB_PANEL_ITEMS
    for sku, name, price in lab_items:
        db.add(
            CatalogItem(
                sku=sku,
                barcode=sku,
                name=name,
                name_mm=name,
                category="lab",
                department="lab",
                price=price,
                cost=price * 0.5,
            )
        )
    db.flush()
    para = db.query(CatalogItem).filter(CatalogItem.sku == "PARA500").first()
    amox = db.query(CatalogItem).filter(CatalogItem.sku == "AMOX500").first()
    db.add(StockBatch(item_id=para.id, warehouse_id=wh.id, batch_no="B2026A", expiry_date=date.today() + timedelta(days=180), qty=500, unit_cost=300))
    if amox:
        db.add(StockBatch(item_id=amox.id, warehouse_id=wh.id, batch_no="B2026B", expiry_date=date.today() + timedelta(days=365), qty=200, unit_cost=900))
    db.add(Promotion(name="OPD 10%", kind="percent", value=10))

    for cat, rates in [("general", (30000, 5000, 250000)), ("icu", (120000, 20000, 900000)), ("vip", (80000, 12000, 600000))]:
        ward = Ward(branch_id=main.id, name=f"{cat.title()} Ward", category=cat)
        db.add(ward)
        db.flush()
        for i in range(1, 6):
            db.add(Bed(ward_id=ward.id, code=f"{cat[:3].upper()}-{i}", daily_rate=rates[0], hourly_rate=rates[1], package_rate=rates[2]))

    db.add(Supplier(name="Myanmar Pharma Co", phone="09-555"))
    db.add(Setting(key="whatsapp_enabled", value="false"))
    db.add(QueueToken(branch_id=main.id, number="A001", patient_id=p1.id, department="OPD"))
    if doctor_user:
        db.add(Appointment(patient_id=p1.id, doctor_id=doctor_user.id, branch_id=main.id, scheduled_at=datetime.utcnow() + timedelta(hours=2), source="counter"))
    db.commit()


def ensure_extra_seed(db: Session) -> None:
    """Idempotently top up an existing DB with rows added by later app versions
    (new demo logins / catalog items) without touching existing data."""
    branch = db.query(Branch).first()
    if not branch:
        return

    pw = hash_password("ShweMuse@123")
    extra_users = [
        ("usg", "usg", "USG Staff"),
        ("lab", "lab_tech", "Lab Tech Aye"),
        ("nurse", "nurse", "Nurse Khin"),
        ("warehouse", "warehouse", "Store Keeper Zaw"),
    ]
    for username, role, name in extra_users:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(username=username, hashed_password=pw, full_name=name, role=role, branch_id=branch.id))

    def _ensure_item(sku: str, name: str, category: str, department: str, price: float, cost_pct: float = 0.6):
        if db.query(CatalogItem).filter(CatalogItem.sku == sku).first():
            return
        db.add(
            CatalogItem(
                sku=sku, barcode=sku, name=name, name_mm=name,
                category=category, department=department,
                price=price, cost=price * cost_pct,
            )
        )

    for sku, name, price in [
        ("USG-ABD", "Abdominal Ultrasound", 25000),
        ("USG-PREG", "Pregnancy Ultrasound", 30000),
        ("USG-PELVIS", "Pelvis Ultrasound", 25000),
    ]:
        _ensure_item(sku, name, "radiology", "usg", price)

    for sku, name, price in [
        ("LAB-CBC", "CBC (Full Blood Count)", 8000),
        ("LAB-FBS", "Fasting Blood Sugar", 5000),
        ("LAB-LFT", "Liver Function Test", 15000),
        ("LAB-RFT", "Renal Function Test", 15000),
        ("LAB-UA", "Urine Analysis", 4000),
    ] + LAB_PANEL_ITEMS:
        _ensure_item(sku, name, "lab", "lab", price, cost_pct=0.5)

    for item in db.query(CatalogItem).filter(CatalogItem.category == "radiology", CatalogItem.department != "usg").all():
        if not item.department or item.department == "radiology":
            item.department = "xray"

    _ensure_lab_reagents(db)

    demo_doctor_specialties = {
        "doctor2": "OG (Obstetrics & Gynecology)",
        "doctor3": "Pediatrics",
    }
    for username, specialty in demo_doctor_specialties.items():
        doc = db.query(User).filter(User.username == username, User.role == "doctor").first()
        if doc and (not doc.specialty or doc.specialty == "General Medicine"):
            doc.specialty = specialty

    db.commit()


# Lab supplies (Store → Lab). Each billed test below consumes 3–4 of these.
LAB_REAGENTS = [
    ("LABS-SYR", "Syringe 5ml"),
    ("LABS-EDTA", "EDTA tube"),
    ("LABS-SST", "Serum gel tube"),
    ("LABS-TIP", "Micropipette tip"),
    ("LABS-SLIDE", "Glass slide"),
    ("LABS-GLOVE", "Exam glove"),
    ("LABS-URINE", "Urine container"),
    ("LABS-STOOL", "Stool container"),
    ("LABS-SPUTUM", "Sputum container"),
    ("LABS-SEMEN", "Semen container"),
    ("LABS-STRIP", "Urine strip"),
    ("LABS-SALINE", "Normal saline"),
    ("LABS-WIDAL", "Widal antigen kit"),
    ("LABS-HCG", "Beta hCG cassette"),
    ("LABS-HBSAG", "HBsAg cassette"),
    ("LABS-HCV", "HCV cassette"),
    ("LABS-HIV", "HIV cassette"),
    ("LABS-VDRL", "VDRL reagent"),
    ("LABS-ABO", "ABO / Rh reagent"),
    ("LABS-CBC", "CBC reagent pack"),
    ("LABS-GLU", "Glucose reagent"),
    ("LABS-LFT", "LFT reagent pack"),
    ("LABS-RFT", "RFT reagent pack"),
    ("LABS-AFB", "AFB stain"),
    ("LABS-ADA", "ADA reagent"),
    ("LABS-CREAT", "Creatinine reagent"),
    ("LABS-ALB", "Albumin reagent"),
    ("LABS-PROT", "Protein reagent"),
    ("LABS-WRIGHT", "Wright stain"),
]

# test sku -> (reagent sku, qty per test)
LAB_RECIPES: dict[str, list[tuple[str, float]]] = {
    "LAB-P01": [("LABS-EDTA", 1), ("LABS-SST", 1), ("LABS-TIP", 2), ("LABS-SYR", 1)],
    "LAB-P02": [("LABS-SST", 1), ("LABS-URINE", 1), ("LABS-TIP", 2), ("LABS-SYR", 1)],
    "LAB-P03": [("LABS-SST", 1), ("LABS-HBSAG", 1), ("LABS-HCV", 1), ("LABS-HIV", 1)],
    "LAB-P04": [("LABS-EDTA", 1), ("LABS-ABO", 1), ("LABS-SLIDE", 1), ("LABS-TIP", 1)],
    "LAB-P05": [("LABS-SST", 1), ("LABS-HCG", 1), ("LABS-TIP", 1), ("LABS-SYR", 1)],
    "LAB-P06": [("LABS-URINE", 1), ("LABS-STRIP", 1), ("LABS-TIP", 1), ("LABS-GLOVE", 1)],
    "LAB-P07": [("LABS-EDTA", 1), ("LABS-ABO", 1), ("LABS-HBSAG", 1), ("LABS-SYR", 1)],
    "LAB-P08": [("LABS-SST", 1), ("LABS-VDRL", 1), ("LABS-SLIDE", 1), ("LABS-TIP", 1)],
    "LAB-P09": [("LABS-SST", 1), ("LABS-WIDAL", 1), ("LABS-SLIDE", 1), ("LABS-TIP", 1)],
    "LAB-P10": [("LABS-SEMEN", 1), ("LABS-SLIDE", 1), ("LABS-TIP", 1), ("LABS-GLOVE", 1)],
    "LAB-P11": [("LABS-SPUTUM", 1), ("LABS-AFB", 1), ("LABS-SLIDE", 1), ("LABS-GLOVE", 1)],
    "LAB-P12": [("LABS-STOOL", 1), ("LABS-SLIDE", 1), ("LABS-SALINE", 1), ("LABS-GLOVE", 1)],
    "LAB-P13": [("LABS-SST", 1), ("LABS-ADA", 1), ("LABS-TIP", 2), ("LABS-SYR", 1)],
    "LAB-P14": [("LABS-URINE", 1), ("LABS-ALB", 1), ("LABS-CREAT", 1), ("LABS-TIP", 2)],
    "LAB-P15": [("LABS-URINE", 1), ("LABS-PROT", 1), ("LABS-CREAT", 1), ("LABS-TIP", 2)],
    "LAB-P16": [("LABS-EDTA", 1), ("LABS-SLIDE", 1), ("LABS-WRIGHT", 1), ("LABS-TIP", 1)],
    "LAB-CBC": [("LABS-EDTA", 1), ("LABS-CBC", 1), ("LABS-TIP", 1), ("LABS-SYR", 1)],
    "LAB-FBS": [("LABS-SST", 1), ("LABS-GLU", 1), ("LABS-TIP", 1), ("LABS-SYR", 1)],
    "LAB-LFT": [("LABS-SST", 1), ("LABS-LFT", 1), ("LABS-TIP", 2), ("LABS-SYR", 1)],
    "LAB-RFT": [("LABS-SST", 1), ("LABS-RFT", 1), ("LABS-TIP", 2), ("LABS-SYR", 1)],
    "LAB-UA": [("LABS-URINE", 1), ("LABS-STRIP", 1), ("LABS-GLOVE", 1), ("LABS-TIP", 1)],
}


def _ensure_lab_reagents(db: Session) -> None:
    warehouse = db.query(Warehouse).order_by(Warehouse.id).first()
    by_sku: dict[str, CatalogItem] = {}
    for sku, name in LAB_REAGENTS:
        item = db.query(CatalogItem).filter(CatalogItem.sku == sku).first()
        if not item:
            item = CatalogItem(
                sku=sku,
                barcode=sku,
                name=name,
                name_mm=name,
                category="supply",
                department="lab",
                unit="ea",
                price=0,
                cost=500,
                is_stock=True,
                min_stock=15,
            )
            db.add(item)
            db.flush()
        by_sku[sku] = item
        if warehouse and not db.query(StockBatch).filter(StockBatch.item_id == item.id).first():
            db.add(StockBatch(
                item_id=item.id,
                warehouse_id=warehouse.id,
                batch_no="LAB-DEMO",
                expiry_date=date.today() + timedelta(days=365),
                qty=120,
                unit_cost=500,
            ))

    tests = {item.sku: item for item in db.query(CatalogItem).filter(CatalogItem.sku.in_(list(LAB_RECIPES))).all()}
    for test_sku, rows in LAB_RECIPES.items():
        test = tests.get(test_sku)
        if not test:
            continue
        for reagent_sku, qty in rows:
            reagent = by_sku.get(reagent_sku)
            if not reagent:
                continue
            exists = (
                db.query(LabTestReagent)
                .filter(LabTestReagent.test_item_id == test.id, LabTestReagent.reagent_item_id == reagent.id)
                .first()
            )
            if not exists:
                db.add(LabTestReagent(test_item_id=test.id, reagent_item_id=reagent.id, qty=qty))
