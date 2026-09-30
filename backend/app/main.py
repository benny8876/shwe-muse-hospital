from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.demo_seed import ensure_demo_seed
from app.db.seed import ensure_extra_seed, seed
from app.db.session import Base, SessionLocal, engine
import app.models  # noqa: F401


def _ensure_schema() -> None:
    insp = inspect(engine)
    if "invoice_lines" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("invoice_lines")}
        if "unit_cost" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE invoice_lines ADD COLUMN unit_cost FLOAT DEFAULT 0"))
    if "patients" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("patients")}
        with engine.begin() as conn:
            if "age_years" not in cols:
                conn.execute(text("ALTER TABLE patients ADD COLUMN age_years INTEGER"))
            if "age_months" not in cols:
                conn.execute(text("ALTER TABLE patients ADD COLUMN age_months INTEGER"))
            if "age_days" not in cols:
                conn.execute(text("ALTER TABLE patients ADD COLUMN age_days INTEGER"))
            if "referring_doctor" not in cols:
                conn.execute(text("ALTER TABLE patients ADD COLUMN referring_doctor VARCHAR(160) DEFAULT ''"))
            if "father_name" not in cols:
                conn.execute(text("ALTER TABLE patients ADD COLUMN father_name VARCHAR(160) DEFAULT ''"))
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "allowed_counters" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN allowed_counters TEXT DEFAULT ''"))
            if "extra_permissions" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN extra_permissions TEXT DEFAULT ''"))
            if "allowed_features" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN allowed_features TEXT DEFAULT ''"))
    if "ward_med_orders" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("ward_med_orders")}
        if "invoice_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE ward_med_orders ADD COLUMN invoice_id INTEGER"))
    if "expenses" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("expenses")}
        with engine.begin() as conn:
            if "name" not in cols:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN name VARCHAR(120) DEFAULT ''"))
            if "paid_by" not in cols:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN paid_by VARCHAR(80) DEFAULT ''"))
    if "appointments" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("appointments")}
        if "duration_minutes" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER DEFAULT 15"))
    admissions_needed_backfill = False
    if "admissions" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("admissions")}
        if "last_room_charge_date" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE admissions ADD COLUMN last_room_charge_date DATE"))
            admissions_needed_backfill = True
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                UPDATE invoice_lines
                SET unit_cost = (
                    SELECT cost FROM catalog_items WHERE catalog_items.id = invoice_lines.item_id
                )
                WHERE source = 'pharmacy' AND (unit_cost IS NULL OR unit_cost = 0) AND item_id IS NOT NULL
                """
            )
        )
        if admissions_needed_backfill:
            # Start the auto room-charge clock from today for admissions that
            # predate this column, rather than from admitted_at — otherwise a
            # long-open admission would suddenly get billed for every day it
            # was already open the first time this ran.
            from datetime import date

            from app.models.ipd import Admission

            for adm in db.query(Admission).filter(Admission.status.in_(["admitted", "transferred"])).all():
                adm.last_room_charge_date = date.today()
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_schema()
    if settings.seed_on_start:
        db = SessionLocal()
        try:
            seed(db)
            ensure_extra_seed(db)
            ensure_demo_seed(db)
        finally:
            db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
