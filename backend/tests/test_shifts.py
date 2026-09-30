from tests.conftest import register_patient


def _close_any_open_shift(client, cashier_headers):
    """cashier_headers is a session-scoped fixture, so an earlier test in
    this file may have left a shift open — start each test from a clean
    (no open shift) state."""
    r = client.get("/api/v1/shifts/current", headers=cashier_headers)
    r.raise_for_status()
    current = r.json()
    if current:
        client.post(f"/api/v1/shifts/{current['id']}/close", headers=cashier_headers, params={"closing_cash": 0})


def test_payment_works_without_an_open_shift(client, reception_headers, cashier_headers, doctor_id):
    """Shift is optional — a cashier who never opens one must still be able
    to take payments normally."""
    _close_any_open_shift(client, cashier_headers)
    result = register_patient(client, reception_headers, doctor_id, "No Shift Patient")
    inv_id, total = result["invoice_id"], result["total"]

    r = client.post(
        f"/api/v1/invoices/{inv_id}/pay-multi",
        json={"payments": [{"method": "cash", "amount": total}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "paid"


def test_shift_z_report_tracks_payments_and_expenses(client, reception_headers, cashier_headers, doctor_id):
    _close_any_open_shift(client, cashier_headers)

    r = client.post("/api/v1/shifts/open", headers=cashier_headers, params={"branch_id": 1, "opening_float": 50000})
    assert r.status_code == 200
    shift = r.json()
    assert shift["opening_float"] == 50000
    assert shift["status"] == "open"

    result = register_patient(client, reception_headers, doctor_id, "Shift Report Patient")
    inv_id, total = result["invoice_id"], result["total"]
    r = client.post(
        f"/api/v1/invoices/{inv_id}/pay-multi",
        json={"payments": [{"method": "cash", "amount": total}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200

    r = client.post(
        "/api/v1/accounts/expenses",
        json={"branch_id": 1, "category": "Supplies", "name": "Tea for staff", "amount": 3000, "paid_from": "petty"},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    assert r.json()["shift_id"] == shift["id"]

    r = client.post(f"/api/v1/shifts/{shift['id']}/close", headers=cashier_headers, params={"closing_cash": 12345})
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    r = client.get(f"/api/v1/shifts/{shift['id']}/z-report", headers=cashier_headers)
    assert r.status_code == 200
    z = r.json()
    assert z["invoice_count"] == 1
    assert z["collected"] == total
    assert z["refunded"] == 0
    assert z["net_collected"] == total
    assert z["expense_total"] == 3000

    # A payment made with no shift open again must not leak into this
    # already-closed shift's report.
    result2 = register_patient(client, reception_headers, doctor_id, "After Close Patient")
    client.post(
        f"/api/v1/invoices/{result2['invoice_id']}/pay-multi",
        json={"payments": [{"method": "cash", "amount": result2['total']}]},
        headers=cashier_headers,
    )
    r = client.get(f"/api/v1/shifts/{shift['id']}/z-report", headers=cashier_headers)
    assert r.json()["invoice_count"] == 1


def test_shift_z_report_nets_out_refunds(client, reception_headers, cashier_headers, doctor_id):
    _close_any_open_shift(client, cashier_headers)
    r = client.post("/api/v1/shifts/open", headers=cashier_headers, params={"branch_id": 1, "opening_float": 0})
    shift = r.json()

    result = register_patient(client, reception_headers, doctor_id, "Refund In Shift Patient")
    inv_id, total = result["invoice_id"], result["total"]
    client.post(
        f"/api/v1/invoices/{inv_id}/pay-multi",
        json={"payments": [{"method": "cash", "amount": total}]},
        headers=cashier_headers,
    )
    r = client.post(
        f"/api/v1/invoices/{inv_id}/refund",
        json={"amount": total, "method": "cash", "reason": "wrong charge"},
        headers=cashier_headers,
    )
    assert r.status_code == 200

    client.post(f"/api/v1/shifts/{shift['id']}/close", headers=cashier_headers, params={"closing_cash": 0})
    r = client.get(f"/api/v1/shifts/{shift['id']}/z-report", headers=cashier_headers)
    z = r.json()
    assert z["collected"] == total
    assert z["refunded"] == total
    assert z["net_collected"] == 0
