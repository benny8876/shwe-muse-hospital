def _available_bed_id(client, admin_headers) -> int:
    r = client.get("/api/v1/ipd/beds", headers=admin_headers)
    r.raise_for_status()
    for bed in r.json():
        if bed["status"] == "available":
            return bed["id"]
    raise AssertionError("seed() should have created at least one available bed")


def test_ipd_dashboard_lists_wards_and_beds(client, reception_headers, admin_headers, doctor_id):
    bed_id = _available_bed_id(client, admin_headers)
    r = client.post(
        "/api/v1/counter/reception",
        json={
            "branch_id": 1,
            "doctor_id": doctor_id,
            "name": "Dashboard Bed Patient",
            "phone": "09-000-333",
            "gender": "M",
            "patient_type": "ipd",
            "bed_id": bed_id,
            "deposit": 50000,
            "billing_mode": "daily",
        },
        headers=reception_headers,
    )
    assert r.status_code == 200

    nurse_headers = {"Authorization": reception_headers["Authorization"]}
    r = client.get("/api/v1/ipd/dashboard", params={"branch_id": 1}, headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    occupied = [b for w in data for b in w["beds"] if b["admission"]]
    assert any(a["patient_name"] == "Dashboard Bed Patient" for b in occupied for a in [b["admission"]])


def test_ipd_deposit_covering_room_charge_keeps_invoice_open_for_pharmacy(client, reception_headers, pharmacy_headers, admin_headers, doctor_id):
    """A deposit that happens to cover the day-one room charge must not flip
    the IPD invoice to "paid" while the admission is still ongoing — that
    silently dropped the patient off every "open invoice" lookup app-wide
    (active-patients, dispense, order endpoints), so Pharmacy (and every
    other counter) could no longer bill them until discharge."""
    bed_id = _available_bed_id(client, admin_headers)

    r = client.post(
        "/api/v1/counter/reception",
        json={
            "branch_id": 1,
            "doctor_id": doctor_id,
            "name": "IPD Deposit Test Patient",
            "phone": "09-000-111",
            "gender": "M",
            "patient_type": "ipd",
            "bed_id": bed_id,
            "deposit": 200000,  # comfortably covers a single day's room rate
            "billing_mode": "daily",
        },
        headers=reception_headers,
    )
    assert r.status_code == 200
    result = r.json()
    patient_id = result["patient"]["id"]
    assert result["deposit"] == 200000

    # still shows up as a billable open bill, from Pharmacy's point of view
    r = client.get("/api/v1/counter/active-patients", params={"branch_id": 1}, headers=pharmacy_headers)
    assert r.status_code == 200
    assert any(row["patient_id"] == patient_id for row in r.json())

    r = client.get(f"/api/v1/counter/patient/{patient_id}/invoice", params={"branch_id": 1}, headers=pharmacy_headers)
    assert r.status_code == 200
    assert r.json()["status"] != "paid"

    # and dispensing to them actually works end-to-end
    items = client.get("/api/v1/inventory/items", headers=pharmacy_headers).json()
    item = next(row for row in items if row["item"]["sku"] == "PARA500")
    warehouse_id = client.get("/api/v1/inventory/warehouses", headers=pharmacy_headers).json()[0]["id"]

    r = client.post(
        "/api/v1/counter/pharmacy",
        json={"branch_id": 1, "patient_id": patient_id, "item_id": item["item"]["id"], "warehouse_id": warehouse_id, "qty": 1},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200


def test_nurse_can_order_medicine_for_ward_patient_and_pharmacy_can_dispense(client, auth_headers, reception_headers, admin_headers, doctor_id):
    nurse_headers = auth_headers("nurse")
    pharmacy_headers = auth_headers("pharmacy")
    bed_id = _available_bed_id(client, admin_headers)

    r = client.post(
        "/api/v1/counter/reception",
        json={
            "branch_id": 1,
            "doctor_id": doctor_id,
            "name": "Ward Order Test Patient",
            "phone": "09-000-222",
            "gender": "F",
            "patient_type": "ipd",
            "bed_id": bed_id,
            "deposit": 0,
            "billing_mode": "daily",
        },
        headers=reception_headers,
    )
    assert r.status_code == 200
    result = r.json()
    patient_id = result["patient"]["id"]
    admission_id = result["admission_id"]

    item = next(row for row in client.get("/api/v1/inventory/items", headers=nurse_headers).json() if row["item"]["sku"] == "PARA500")

    r = client.post(
        "/api/v1/ward-orders",
        json={
            "patient_id": patient_id,
            "branch_id": 1,
            "admission_id": admission_id,
            "note": "BP high",
            "items": [{"item_id": item["item"]["id"], "qty": 2}],
        },
        headers=nurse_headers,
    )
    assert r.status_code == 200
    order_item_id = r.json()["items"][0]["id"]

    # a non-nurse, non-admin role cannot place ward orders
    r = client.post(
        "/api/v1/ward-orders",
        json={"patient_id": patient_id, "branch_id": 1, "items": [{"item_id": item["item"]["id"], "qty": 1}]},
        headers=pharmacy_headers,
    )
    assert r.status_code == 403

    r = client.get("/api/v1/ward-orders/pending", params={"branch_id": 1}, headers=pharmacy_headers)
    assert r.status_code == 200
    row = next(p for p in r.json() if p["order_item_id"] == order_item_id)
    assert row["patient_id"] == patient_id
    assert row["qty"] == 2
    assert row["note"] == "BP high"

    warehouse_id = client.get("/api/v1/inventory/warehouses", headers=pharmacy_headers).json()[0]["id"]
    r = client.post(f"/api/v1/ward-orders/items/{order_item_id}/dispense", params={"warehouse_id": warehouse_id}, headers=pharmacy_headers)
    assert r.status_code == 200

    # fulfilled orders drop off the pending queue...
    r = client.get("/api/v1/ward-orders/pending", params={"branch_id": 1}, headers=pharmacy_headers)
    assert all(p["order_item_id"] != order_item_id for p in r.json())

    # ...and the nurse can see it was dispensed
    r = client.get(f"/api/v1/ward-orders/patient/{patient_id}", params={"branch_id": 1}, headers=nurse_headers)
    assert r.status_code == 200
    statuses = [i["status"] for o in r.json() for i in o["items"]]
    assert statuses == ["dispensed"]

    # dispensing the same order item twice is rejected, not double-billed
    r = client.post(f"/api/v1/ward-orders/items/{order_item_id}/dispense", params={"warehouse_id": warehouse_id}, headers=pharmacy_headers)
    assert r.status_code == 404
