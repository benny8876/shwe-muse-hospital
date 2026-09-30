from tests.conftest import register_patient


def test_refund_reduces_paid_and_increases_balance(client, reception_headers, doctor_id, auth_headers):
    result = register_patient(client, reception_headers, doctor_id, "Refund Test Patient")
    invoice_id = result["invoice_id"]
    cashier_headers = auth_headers("cashier")

    r = client.get(f"/api/v1/invoices/{invoice_id}", headers=cashier_headers)
    balance_before = r.json()["balance"]
    assert balance_before > 0

    r = client.post(f"/api/v1/invoices/{invoice_id}/pay", json={"method": "cash", "amount": balance_before}, headers=cashier_headers)
    assert r.status_code == 200
    inv = r.json()["invoice"]
    assert inv["balance"] == 0
    assert inv["status"] == "paid"

    r = client.post(f"/api/v1/invoices/{invoice_id}/refund", json={"amount": balance_before, "method": "cash", "reason": "wrong amount"}, headers=cashier_headers)
    assert r.status_code == 200
    inv = r.json()["invoice"]
    assert inv["paid"] == 0
    assert inv["balance"] == balance_before
    assert inv["status"] != "paid"

    methods = [p["method"] for p in inv["payments"]]
    assert "cash" in methods
    assert "refund" in methods


def test_refund_cannot_exceed_paid_amount(client, reception_headers, doctor_id, auth_headers):
    result = register_patient(client, reception_headers, doctor_id, "Refund Over Test")
    invoice_id = result["invoice_id"]
    cashier_headers = auth_headers("cashier")

    r = client.get(f"/api/v1/invoices/{invoice_id}", headers=cashier_headers)
    balance = r.json()["balance"]
    client.post(f"/api/v1/invoices/{invoice_id}/pay", json={"method": "cash", "amount": balance}, headers=cashier_headers)

    r = client.post(f"/api/v1/invoices/{invoice_id}/refund", json={"amount": balance + 1000}, headers=cashier_headers)
    assert r.status_code == 400


def test_void_line_removes_it_and_recalculates_total(client, reception_headers, doctor_id, auth_headers):
    result = register_patient(client, reception_headers, doctor_id, "Void Test Patient")
    invoice_id = result["invoice_id"]
    cashier_headers = auth_headers("cashier")

    r = client.get(f"/api/v1/invoices/{invoice_id}", headers=cashier_headers)
    inv = r.json()
    line_id = inv["lines"][0]["id"]
    total_before = inv["total"]
    line_amount = inv["lines"][0]["amount"]

    r = client.delete(f"/api/v1/invoices/{invoice_id}/lines/{line_id}", headers=cashier_headers)
    assert r.status_code == 200
    inv = r.json()
    assert inv["total"] == total_before - line_amount
    assert all(l["id"] != line_id for l in inv["lines"])


def test_void_nonexistent_line_404s(client, reception_headers, doctor_id, auth_headers):
    result = register_patient(client, reception_headers, doctor_id, "Void 404 Test")
    invoice_id = result["invoice_id"]
    cashier_headers = auth_headers("cashier")

    r = client.delete(f"/api/v1/invoices/{invoice_id}/lines/999999", headers=cashier_headers)
    assert r.status_code == 404
