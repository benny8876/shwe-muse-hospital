"""Seed ~100 pharmacy medicines with stock for testing."""

from __future__ import annotations

import random
from datetime import date, timedelta

from app.db.session import SessionLocal
from app.models.catalog import CatalogItem
from app.models.org import Warehouse
from app.services.inventory_service import create_medicine, receive_stock, stock_on_hand

MEDICINES: list[tuple[str, str, float]] = [
    ("MED-001", "Paracetamol 500mg Tab", 500),
    ("MED-002", "Ibuprofen 400mg Tab", 800),
    ("MED-003", "Amoxicillin 500mg Cap", 1500),
    ("MED-004", "Amoxicillin 250mg Syrup", 3500),
    ("MED-005", "Azithromycin 500mg Tab", 2500),
    ("MED-006", "Cefixime 200mg Tab", 3000),
    ("MED-007", "Ciprofloxacin 500mg Tab", 2200),
    ("MED-008", "Metronidazole 400mg Tab", 600),
    ("MED-009", "Doxycycline 100mg Cap", 900),
    ("MED-010", "Clarithromycin 500mg Tab", 2800),
    ("MED-011", "Cephalexin 500mg Cap", 1800),
    ("MED-012", "Erythromycin 250mg Tab", 1200),
    ("MED-013", "Fluconazole 150mg Cap", 3500),
    ("MED-014", "Acyclovir 400mg Tab", 4000),
    ("MED-015", "ORS Sachet", 300),
    ("MED-016", "Zinc Sulphate 20mg Tab", 400),
    ("MED-017", "Multivitamin Tab", 700),
    ("MED-018", "Vitamin C 500mg Tab", 500),
    ("MED-019", "Vitamin B Complex Tab", 600),
    ("MED-020", "Calcium + Vitamin D Tab", 900),
    ("MED-021", "Iron + Folic Acid Tab", 800),
    ("MED-022", "Folic Acid 5mg Tab", 300),
    ("MED-023", "Cetirizine 10mg Tab", 400),
    ("MED-024", "Loratadine 10mg Tab", 500),
    ("MED-025", "Chlorpheniramine 4mg Tab", 200),
    ("MED-026", "Dexamethasone 0.5mg Tab", 300),
    ("MED-027", "Prednisolone 5mg Tab", 400),
    ("MED-028", "Hydrocortisone Cream 1%", 2500),
    ("MED-029", "Betamethasone Cream", 2800),
    ("MED-030", "Clotrimazole Cream 1%", 2200),
    ("MED-031", "Miconazole Cream", 2400),
    ("MED-032", "Acyclovir Cream 5%", 4500),
    ("MED-033", "Salbutamol Inhaler 100mcg", 8500),
    ("MED-034", "Budesonide Inhaler", 12000),
    ("MED-035", "Ambroxol 30mg Tab", 600),
    ("MED-036", "Guaifenesin Syrup", 3200),
    ("MED-037", "Dextromethorphan Syrup", 3500),
    ("MED-038", "Loratadine Syrup", 4200),
    ("MED-039", "Omeprazole 20mg Cap", 900),
    ("MED-040", "Esomeprazole 40mg Tab", 1500),
    ("MED-041", "Ranitidine 150mg Tab", 500),
    ("MED-042", "Domperidone 10mg Tab", 400),
    ("MED-043", "Metoclopramide 10mg Tab", 350),
    ("MED-044", "Hyoscine Butylbromide 10mg Tab", 500),
    ("MED-045", "Loperamide 2mg Cap", 600),
    ("MED-046", "Bisacodyl 5mg Tab", 400),
    ("MED-047", "Lactulose Syrup", 5500),
    ("MED-048", "ORS + Zinc Kit", 800),
    ("MED-049", "Amlodipine 5mg Tab", 700),
    ("MED-050", "Amlodipine 10mg Tab", 900),
    ("MED-051", "Losartan 50mg Tab", 1200),
    ("MED-052", "Telmisartan 40mg Tab", 1500),
    ("MED-053", "Enalapril 5mg Tab", 600),
    ("MED-054", "Atenolol 50mg Tab", 500),
    ("MED-055", "Metoprolol 50mg Tab", 800),
    ("MED-056", "Propranolol 40mg Tab", 400),
    ("MED-057", "Hydrochlorothiazide 25mg Tab", 400),
    ("MED-058", "Spironolactone 25mg Tab", 900),
    ("MED-059", "Furosemide 40mg Tab", 500),
    ("MED-060", "Glibenclamide 5mg Tab", 400),
    ("MED-061", "Metformin 500mg Tab", 500),
    ("MED-062", "Metformin 850mg Tab", 700),
    ("MED-063", "Gliclazide 80mg Tab", 800),
    ("MED-064", "Insulin NPH 10ml", 18000),
    ("MED-065", "Insulin Regular 10ml", 16000),
    ("MED-066", "Atorvastatin 20mg Tab", 1200),
    ("MED-067", "Simvastatin 20mg Tab", 1000),
    ("MED-068", "Clopidogrel 75mg Tab", 2500),
    ("MED-069", "Aspirin 81mg Tab", 300),
    ("MED-070", "Warfarin 5mg Tab", 900),
    ("MED-071", "Isosorbide Mononitrate 20mg Tab", 800),
    ("MED-072", "Nitroglycerin Sublingual Tab", 1500),
    ("MED-073", "Carbamazepine 200mg Tab", 1100),
    ("MED-074", "Sodium Valproate 200mg Tab", 1200),
    ("MED-075", "Phenytoin 100mg Cap", 900),
    ("MED-076", "Levetiracetam 500mg Tab", 3500),
    ("MED-077", "Amitriptyline 25mg Tab", 600),
    ("MED-078", "Sertraline 50mg Tab", 1800),
    ("MED-079", "Diazepam 5mg Tab", 500),
    ("MED-080", "Alprazolam 0.5mg Tab", 800),
    ("MED-081", "Tramadol 50mg Cap", 1200),
    ("MED-082", "Diclofenac 50mg Tab", 600),
    ("MED-083", "Diclofenac Gel 1%", 3500),
    ("MED-084", "Naproxen 250mg Tab", 700),
    ("MED-085", "Mefenamic Acid 500mg Cap", 800),
    ("MED-086", "Piroxicam 20mg Cap", 900),
    ("MED-087", "Chloroquine 250mg Tab", 500),
    ("MED-088", "Artemether-Lumefantrine Tab", 4500),
    ("MED-089", "Primaquine 15mg Tab", 600),
    ("MED-090", "Albendazole 400mg Tab", 800),
    ("MED-091", "Mebendazole 500mg Tab", 700),
    ("MED-092", "Levothyroxine 50mcg Tab", 900),
    ("MED-093", "Levothyroxine 100mcg Tab", 1100),
    ("MED-094", "Allopurinol 100mg Tab", 700),
    ("MED-095", "Colchicine 0.5mg Tab", 1200),
    ("MED-096", "Tamsulosin 0.4mg Cap", 1800),
    ("MED-097", "Finasteride 5mg Tab", 2200),
    ("MED-098", "Oxytocin 10 IU Amp", 3500),
    ("MED-099", "Misoprostol 200mcg Tab", 2500),
    ("MED-100", "Normal Saline 500ml", 1500),
]


def seed_pharmacy_test() -> None:
    db = SessionLocal()
    try:
        warehouse = db.query(Warehouse).filter(Warehouse.is_default == True).first()  # noqa: E712
        if not warehouse:
            warehouse = db.query(Warehouse).first()
        if not warehouse:
            raise RuntimeError("No warehouse found — run main seed first")

        created = 0
        stocked = 0
        skipped = 0

        for sku, name, price in MEDICINES:
            existing = db.query(CatalogItem).filter(CatalogItem.sku == sku).first()
            if existing:
                item = existing
                skipped += 1
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
                created += 1

            on_hand = stock_on_hand(db, item.id, warehouse.id)
            if on_hand < 10:
                qty = random.randint(80, 400)
                expiry = date.today() + timedelta(days=random.randint(180, 720))
                receive_stock(
                    db,
                    item_id=item.id,
                    warehouse_id=warehouse.id,
                    qty=qty,
                    unit_cost=round(price * 0.65, 2),
                    batch_no=f"TEST-{sku}",
                    expiry=expiry,
                    user_id=None,
                )
                stocked += 1

        db.commit()
        total = db.query(CatalogItem).filter(CatalogItem.is_stock == True).count()  # noqa: E712
        print(f"Done: created={created}, skipped={skipped}, stocked={stocked}, total_stock_items={total}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_pharmacy_test()
