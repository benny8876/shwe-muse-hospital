from tests.conftest import register_patient


def test_patient_medical_history_lists_visits_and_treatments(client, reception_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Medical History Patient")
    patient_id = result["patient"]["id"]
    r = client.get(
        f"/api/v1/counter/patient-medical-history?patient_id={patient_id}&branch_id=1",
        headers=reception_headers,
    )
    r.raise_for_status()
    data = r.json()
    assert data["patient"]["uhid"] == result["patient"]["uhid"]
    assert len(data["visits"]) >= 1
    visit = data["visits"][0]
    assert visit["bill_number"] == result["invoice_number"]
    assert any(t["category"] == "opd" for t in visit["treatments"])


def test_reception_register_creates_invoice_with_consultation_fee(client, reception_headers, cashier_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Billing Test Patient A")
    assert result["patient_type"] == "opd"
    assert result["total"] == result["consultation_fee"]
    assert result["balance"] == result["total"]

    inv = client.get(f"/api/v1/invoices/{result['invoice_id']}", headers=cashier_headers).json()
    assert inv["status"] in ("open", "draft")
    assert len(inv["lines"]) == 1
    assert inv["lines"][0]["source"] == "opd"
    assert inv["lines"][0]["amount"] == result["consultation_fee"]


def test_edit_invoice_line_recalculates_totals(client, reception_headers, cashier_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Billing Test Patient B")
    inv_id = result["invoice_id"]
    inv = client.get(f"/api/v1/invoices/{inv_id}", headers=cashier_headers).json()
    line_id = inv["lines"][0]["id"]

    r = client.patch(
        f"/api/v1/invoices/{inv_id}/lines/{line_id}",
        json={"unit_price": 12345},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    assert r.json()["amount"] == 12345

    inv = client.get(f"/api/v1/invoices/{inv_id}", headers=cashier_headers).json()
    assert inv["total"] == 12345
    assert inv["balance"] == 12345


def test_negative_price_rejected(client, reception_headers, cashier_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Billing Test Patient C")
    inv = client.get(f"/api/v1/invoices/{result['invoice_id']}", headers=cashier_headers).json()
    line_id = inv["lines"][0]["id"]

    r = client.patch(
        f"/api/v1/invoices/{result['invoice_id']}/lines/{line_id}",
        json={"unit_price": -100},
        headers=cashier_headers,
    )
    assert r.status_code == 400


def test_pay_multi_full_payment_marks_invoice_paid(client, reception_headers, cashier_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Billing Test Patient D")
    inv_id = result["invoice_id"]
    total = result["total"]

    r = client.post(
        f"/api/v1/invoices/{inv_id}/pay-multi",
        json={"payments": [{"method": "cash", "amount": total}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "paid"
    assert data["balance"] == 0
    assert data["paid"] == total


def test_pay_multi_partial_payment_keeps_balance(client, reception_headers, cashier_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Billing Test Patient E")
    inv_id = result["invoice_id"]
    total = result["total"]
    half = total / 2

    r = client.post(
        f"/api/v1/invoices/{inv_id}/pay-multi",
        json={"payments": [{"method": "cash", "amount": half}]},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "partial"
    assert data["balance"] == total - half
