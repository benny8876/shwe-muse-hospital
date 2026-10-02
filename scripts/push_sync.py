#!/usr/bin/env python3
"""Branch -> cloud sync push, meant to run on each branch's offline server via
cron (e.g. nightly). Reads this branch's own local database directly through
the same service functions the live app uses (no parallel reporting logic),
builds a compact rollup, and POSTs it to the cloud Admin Panel instance's
POST /sync/push — see backend/app/api/v1/sync.py for the receiving end and
docs/cloud-admin-deploy.md for how that cloud instance gets set up.

This only ever reads from the branch DB and sends summaries out — it never
opens an inbound connection into the branch's LAN, matching the push-only
architecture decided on for the offline-branch + cloud-admin setup.

Usage (run from backend/, with its venv active, same as any other script here):
    python3 ../scripts/push_sync.py

Env vars (all required except PERIOD):
    SYNC_CLOUD_URL    e.g. https://admin.example.com/api/v1/sync/push
    SYNC_SHARED_KEY   must match the cloud instance's SYNC_SHARED_KEY setting
    BRANCH_ID         this branch's local numeric id (usually 1)
    BRANCH_CODE       this branch's code (e.g. "BR1") — identifies it on the cloud side
    PERIOD            day|month|3m|year (default "day" — a nightly rollup of that day)
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import httpx  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.services.admin_service import list_capital_assets  # noqa: E402
from app.services.counter_service import cashier_analytics  # noqa: E402
from app.services.inventory_service import stock_on_hand  # noqa: E402
from app.models.catalog import CatalogItem  # noqa: E402
from app.models.org import Warehouse  # noqa: E402

CLOUD_URL = os.environ["SYNC_CLOUD_URL"]
SHARED_KEY = os.environ["SYNC_SHARED_KEY"]
BRANCH_ID = int(os.environ["BRANCH_ID"])
BRANCH_CODE = os.environ["BRANCH_CODE"]
PERIOD = os.environ.get("PERIOD", "day")


def build_stock_snapshot(db, branch_id: int) -> list[dict]:
    warehouse_ids = [w.id for w in db.query(Warehouse).filter(Warehouse.branch_id == branch_id)]
    rows = db.query(CatalogItem).filter(CatalogItem.is_stock == True).all()  # noqa: E712
    return [
        {"sku": r.sku, "name": r.name, "on_hand": stock_on_hand(db, r.id, warehouse_ids)}
        for r in rows
    ]


def main() -> None:
    db = SessionLocal()
    try:
        analytics = cashier_analytics(db, BRANCH_ID, PERIOD)
        stock_snapshot = build_stock_snapshot(db, BRANCH_ID)
        capital_assets = [
            {"name": a.name, "category": a.category, "cost": a.cost, "purchased_on": a.purchased_on.isoformat()}
            for a in list_capital_assets(db, BRANCH_ID)
        ]
    finally:
        db.close()

    payload = {
        "branch_code": BRANCH_CODE,
        "period_label": analytics["period_label"],
        "date_from": analytics["from_date"],
        "date_to": analytics["to_date"],
        "analytics": analytics,
        "stock_snapshot": stock_snapshot,
        "capital_assets": capital_assets,
    }
    resp = httpx.post(CLOUD_URL, json=payload, headers={"X-Sync-Key": SHARED_KEY}, timeout=30)
    resp.raise_for_status()
    print(f"Pushed snapshot for {BRANCH_CODE} ({analytics['period_label']}) -> {CLOUD_URL}: {resp.json()}")


if __name__ == "__main__":
    main()
