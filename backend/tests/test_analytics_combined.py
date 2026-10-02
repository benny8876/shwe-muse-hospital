from tests.conftest import register_patient


def _unique_code(prefix: str) -> str:
    import time
    return f"{prefix}{int(time.time() * 1000) % 1_000_000}"


def test_combined_analytics_equals_sum_of_branches(client, admin_headers, reception_headers, cashier_headers, doctor_id):
    # A second branch, isolated from whatever "Branch 1" already has from other
    # tests/seed data — the combined view must equal branch_1 + branch_2 exactly,
    # regardless of what either branch's numbers happen to be at this point.
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": _unique_code("CMB"), "name": "Combined Test Branch"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    branch2_id = r.json()["id"]

    result1 = register_patient(client, reception_headers, doctor_id, "Combined Test P1", branch_id=1)
    r = client.post(
        f"/api/v1/invoices/{result1['invoice_id']}/pay-multi",
        json={"payments": [{"method": "cash", "amount": result1["total"]}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200

    result2 = register_patient(client, reception_headers, doctor_id, "Combined Test P2", branch_id=branch2_id)
    r = client.post(
        f"/api/v1/invoices/{result2['invoice_id']}/pay-multi",
        json={"payments": [{"method": "cash", "amount": result2["total"]}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200

    r1 = client.get("/api/v1/counter/analytics", params={"branch_id": 1, "period": "day"}, headers=cashier_headers)
    r2 = client.get("/api/v1/counter/analytics", params={"branch_id": branch2_id, "period": "day"}, headers=cashier_headers)
    rc = client.get("/api/v1/counter/analytics", params={"period": "day"}, headers=cashier_headers)
    assert r1.status_code == r2.status_code == rc.status_code == 200
    a1, a2, combined = r1.json(), r2.json(), rc.json()

    assert combined["total_collected"] == a1["total_collected"] + a2["total_collected"]
    assert combined["total_bills"] == a1["total_bills"] + a2["total_bills"]
    assert combined["paid_bills"] == a1["paid_bills"] + a2["paid_bills"]
    assert combined["net"] == combined["total_collected"] - combined["total_expenses"]


def test_combined_stock_sums_every_branch_warehouse(client, admin_headers):
    r_all = client.get("/api/v1/inventory/items", headers=admin_headers)
    r_branch1 = client.get("/api/v1/inventory/items", params={"branch_id": 1}, headers=admin_headers)
    assert r_all.status_code == r_branch1.status_code == 200
    # Branch 1 owns the seeded warehouse(s), so scoping to just branch 1 must
    # never report *more* stock for any item than the unscoped "every branch" call.
    all_by_sku = {row["item"]["sku"]: row["on_hand"] for row in r_all.json()}
    for row in r_branch1.json():
        assert row["on_hand"] <= all_by_sku.get(row["item"]["sku"], 0) + 0.001
