from app.core.config import settings

PUSH_PAYLOAD = {
    "branch_code": "TESTBR",
    "period_label": "Today",
    "date_from": "2026-01-01T00:00:00",
    "date_to": "2026-01-01T23:59:59",
    "analytics": {"total_collected": 12345, "net": 10000},
    "stock_snapshot": [{"sku": "SKU1", "name": "Test Item", "on_hand": 5}],
    "capital_assets": [{"name": "Test Machine", "category": "Lab", "cost": 1000000, "purchased_on": "2026-01-01"}],
}


def test_push_rejects_missing_or_wrong_sync_key(client):
    r = client.post("/api/v1/sync/push", json=PUSH_PAYLOAD)
    assert r.status_code == 401

    r = client.post("/api/v1/sync/push", json=PUSH_PAYLOAD, headers={"X-Sync-Key": "wrong-key"})
    assert r.status_code == 401


def test_push_then_latest_round_trip(client, admin_headers):
    r = client.post("/api/v1/sync/push", json=PUSH_PAYLOAD, headers={"X-Sync-Key": settings.sync_shared_key})
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r = client.get("/api/v1/sync/latest", headers=admin_headers)
    assert r.status_code == 200
    rows = {row["branch_code"]: row for row in r.json()}
    assert "TESTBR" in rows
    row = rows["TESTBR"]
    assert row["analytics"]["total_collected"] == 12345
    assert row["stock_snapshot"][0]["sku"] == "SKU1"
    assert row["capital_assets"][0]["name"] == "Test Machine"


def test_latest_requires_admin(client, cashier_headers):
    r = client.get("/api/v1/sync/latest", headers=cashier_headers)
    assert r.status_code == 403
