from tests.conftest import register_patient


def _find_item(client, headers, sku: str):
    items = client.get("/api/v1/inventory/items", headers=headers).json()
    for row in items:
        if row["item"]["sku"] == sku:
            return row
    raise AssertionError(f"seeded item {sku} not found")


def _first_warehouse_id(client, headers) -> int:
    warehouses = client.get("/api/v1/inventory/warehouses", headers=headers).json()
    assert warehouses, "seed() should have created a default warehouse"
    return warehouses[0]["id"]


def test_cashier_adds_pharmacy_item_and_stock_decrements(client, reception_headers, doctor_id, auth_headers):
    cashier_headers = auth_headers("cashier")
    result = register_patient(client, reception_headers, doctor_id, "Cashier Add Item Patient")
    invoice_id = result["invoice_id"]

    before = _find_item(client, cashier_headers, "PARA500")
    on_hand_before = before["on_hand"]
    warehouse_id = _first_warehouse_id(client, cashier_headers)

    r = client.post(
        f"/api/v1/invoices/{invoice_id}/lines/pharmacy",
        json={"item_id": before["item"]["id"], "warehouse_id": warehouse_id, "qty": 2},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    inv = r.json()
    assert any(l["description"] == "Paracetamol 500mg" for l in inv["lines"])

    after = _find_item(client, cashier_headers, "PARA500")
    assert after["on_hand"] == on_hand_before - 2


def test_cashier_cannot_add_stock_item_via_generic_line_endpoint(client, reception_headers, doctor_id, auth_headers):
    cashier_headers = auth_headers("cashier")
    result = register_patient(client, reception_headers, doctor_id, "Cashier Blocked Item Patient")
    invoice_id = result["invoice_id"]

    item = _find_item(client, cashier_headers, "PARA500")
    r = client.post(
        f"/api/v1/invoices/{invoice_id}/lines",
        json={"item_id": item["item"]["id"], "qty": 1, "unit_price": item["item"]["price"], "source": "pharmacy"},
        headers=cashier_headers,
    )
    assert r.status_code == 400


def test_cashier_adds_non_stock_service_item_via_generic_line_endpoint(client, reception_headers, doctor_id, auth_headers):
    cashier_headers = auth_headers("cashier")
    result = register_patient(client, reception_headers, doctor_id, "Cashier Service Item Patient")
    invoice_id = result["invoice_id"]

    catalog = client.get("/api/v1/catalog", params={"q": "General Physician Panel"}, headers=cashier_headers).json()
    assert catalog, "seeded lab catalog item should be searchable"
    item = catalog[0]

    r = client.post(
        f"/api/v1/invoices/{invoice_id}/lines",
        json={"item_id": item["id"], "qty": 1, "unit_price": item["price"], "source": "lab", "description": item["name"]},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    line = r.json()
    assert line["description"] == item["name"]
