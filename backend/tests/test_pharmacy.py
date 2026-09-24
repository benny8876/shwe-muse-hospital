from tests.conftest import register_patient


def _find_item(client, pharmacy_headers, sku: str):
    items = client.get("/api/v1/inventory/items", headers=pharmacy_headers).json()
    for row in items:
        if row["item"]["sku"] == sku:
            return row
    raise AssertionError(f"seeded item {sku} not found")


def _first_warehouse_id(client, pharmacy_headers) -> int:
    warehouses = client.get("/api/v1/inventory/warehouses", headers=pharmacy_headers).json()
    assert warehouses, "seed() should have created a default warehouse"
    return warehouses[0]["id"]


def test_dispense_decrements_stock_and_bills_invoice(client, reception_headers, pharmacy_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Pharmacy Test Patient A")
    before = _find_item(client, pharmacy_headers, "PARA500")
    warehouse_id = _first_warehouse_id(client, pharmacy_headers)

    r = client.post(
        "/api/v1/counter/pharmacy",
        json={
            "branch_id": 1,
            "patient_id": result["patient"]["id"],
            "item_id": before["item"]["id"],
            "warehouse_id": warehouse_id,
            "qty": 3,
        },
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["total"] == result["total"] + before["item"]["price"] * 3

    after = _find_item(client, pharmacy_headers, "PARA500")
    assert after["on_hand"] == before["on_hand"] - 3

    # pharmacist can correct the qty on their own already-dispensed line...
    invoice = client.get(
        f"/api/v1/counter/patient/{result['patient']['id']}/invoice",
        params={"branch_id": 1},
        headers=pharmacy_headers,
    ).json()
    line = next(l for l in invoice["lines"] if l["source"] == "pharmacy")
    r = client.patch(f"/api/v1/counter/pharmacy/lines/{line['id']}", params={"qty": 5}, headers=pharmacy_headers)
    assert r.status_code == 200
    invoice = client.get(
        f"/api/v1/counter/patient/{result['patient']['id']}/invoice",
        params={"branch_id": 1},
        headers=pharmacy_headers,
    ).json()
    assert next(l for l in invoice["lines"] if l["id"] == line["id"])["qty"] == 5

    # ...but this endpoint is qty-only — it can't be used to sneak in a price change
    r = client.patch(f"/api/v1/counter/pharmacy/lines/{line['id']}", params={"qty": 1, "unit_price": 1}, headers=pharmacy_headers)
    assert r.status_code == 200
    invoice = client.get(
        f"/api/v1/counter/patient/{result['patient']['id']}/invoice",
        params={"branch_id": 1},
        headers=pharmacy_headers,
    ).json()
    edited_line = next(l for l in invoice["lines"] if l["id"] == line["id"])
    assert edited_line["qty"] == 1
    assert edited_line["unit_price"] == before["item"]["price"]


def test_pharmacist_can_manage_own_stock_supplier_and_price(client, pharmacy_headers, reception_headers):
    warehouse_id = _first_warehouse_id(client, pharmacy_headers)

    # add a new medicine
    r = client.post(
        "/api/v1/inventory/medicines",
        json={"name": "Test Suite Cough Syrup", "sku": "", "price": 3000, "cost": 1500, "min_stock": 5},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    item = r.json()

    # price change
    r = client.patch(f"/api/v1/inventory/medicines/{item['id']}", json={"price": 3500}, headers=pharmacy_headers)
    assert r.status_code == 200
    assert r.json()["price"] == 3500

    # stock in (receive)
    r = client.post(
        "/api/v1/inventory/receive",
        json={"item_id": item["id"], "warehouse_id": warehouse_id, "qty": 20, "unit_cost": 1500, "batch_no": "TS-1", "expiry_date": "2030-01-01"},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200

    # supplier add
    r = client.post("/api/v1/inventory/suppliers", params={"name": "Test Suite Supplier", "phone": "09-1"}, headers=pharmacy_headers)
    assert r.status_code == 200

    # new warehouse — shared Stock Management page lets pharmacy/cashier/warehouse add one, not admin-only
    r = client.post("/api/v1/inventory/warehouses", params={"name": "Test Suite Warehouse", "branch_id": 1}, headers=pharmacy_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Test Suite Warehouse"

    # a non-pharmacy/non-inventory role is blocked from all of the above
    assert client.post(
        "/api/v1/inventory/medicines",
        json={"name": "Blocked Med", "sku": "", "price": 1000},
        headers=reception_headers,
    ).status_code == 403
    assert client.post(
        "/api/v1/inventory/receive",
        json={"item_id": item["id"], "warehouse_id": warehouse_id, "qty": 1, "unit_cost": 0, "batch_no": ""},
        headers=reception_headers,
    ).status_code == 403


def test_pharmacy_history_includes_price_for_walk_in_customers(client, reception_headers, pharmacy_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Pharmacy History Patient")
    item = _find_item(client, pharmacy_headers, "PARA500")
    warehouse_id = _first_warehouse_id(client, pharmacy_headers)

    r = client.post(
        "/api/v1/counter/pharmacy",
        json={"branch_id": 1, "patient_id": result["patient"]["id"], "item_id": item["item"]["id"], "warehouse_id": warehouse_id, "qty": 2},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200

    r = client.get("/api/v1/counter/pharmacy/history", params={"branch_id": 1, "q": result["patient"]["uhid"]}, headers=pharmacy_headers)
    assert r.status_code == 200
    rows = r.json()
    assert rows, "should find the dispense just made"
    row = rows[0]
    assert row["qty"] == 2
    assert row["unit_price"] == item["item"]["price"]
    assert row["amount"] == item["item"]["price"] * 2


def test_pharmacy_walk_in_sale_creates_patient_and_lets_dispense(client, pharmacy_headers):
    item = _find_item(client, pharmacy_headers, "PARA500")
    warehouse_id = _first_warehouse_id(client, pharmacy_headers)

    r = client.post(
        "/api/v1/counter/pharmacy/walk-in",
        params={"branch_id": 1, "name": "Walk-in Ko Ko", "phone": "09-555"},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    walkin = r.json()
    assert walkin["name"] == "Walk-in Ko Ko"
    assert walkin["uhid"]
    assert walkin["invoice_kind"] == "pos"
    assert walkin["balance"] == 0

    # the new walk-in patient can be dispensed to immediately, same as a
    # Reception-registered patient — no separate registration step needed
    r = client.post(
        "/api/v1/counter/pharmacy",
        json={"branch_id": 1, "patient_id": walkin["patient_id"], "item_id": item["item"]["id"], "warehouse_id": warehouse_id, "qty": 1},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == item["item"]["price"]


def test_pharmacy_walk_in_sale_defaults_name_when_blank(client, pharmacy_headers):
    r = client.post(
        "/api/v1/counter/pharmacy/walk-in",
        params={"branch_id": 1},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Walk-in Customer"
