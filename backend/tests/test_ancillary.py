from tests.conftest import register_patient


def test_xray_items_exclude_usg_department(client, xray_headers):
    """Regression test: X-ray's item list used to leak department='usg' items
    because it filtered on category='radiology' only, with no department check."""
    xray_items = client.get("/api/v1/counter/xray-items", headers=xray_headers).json()
    assert xray_items, "seed() should have created X-ray items"
    for item in xray_items:
        assert item["department"] != "usg"


def test_lab_order_bills_invoice_and_creates_order(client, reception_headers, lab_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Lab Test Patient A")
    lab_items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    item = next(i for i in lab_items if i["sku"] == "LAB-P16")

    r = client.post(
        "/api/v1/counter/lab",
        json={"branch_id": 1, "patient_id": result["patient"]["id"], "item_id": item["id"]},
        headers=lab_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == result["total"] + item["price"]

    orders = client.get("/api/v1/counter/lab-orders", params={"branch_id": 1, "status": "all"}, headers=lab_headers).json()
    order = next(o for o in orders if o["order_id"] == data["order_id"])
    assert order["status"] == "ordered"

    r = client.patch(
        f"/api/v1/counter/lab/{data['order_id']}/result",
        json={"order_id": data["order_id"], "result": "Normal"},
        headers=lab_headers,
    )
    assert r.status_code == 200

    orders = client.get("/api/v1/counter/lab-orders", params={"branch_id": 1, "status": "all"}, headers=lab_headers).json()
    order = next(o for o in orders if o["order_id"] == data["order_id"])
    assert order["status"] == "completed"
    assert order["result"] == "Normal"

    history = client.get(
        "/api/v1/counter/lab/history",
        params={"branch_id": 1, "q": "Lab Test Patient A", "status": "completed", "test": item["name"]},
        headers=lab_headers,
    )
    assert history.status_code == 200
    assert any(o["order_id"] == data["order_id"] for o in history.json())

    hidden = client.get(
        "/api/v1/counter/lab/history",
        params={"branch_id": 1, "q": "Lab Test Patient A", "status": "ordered"},
        headers=lab_headers,
    )
    assert all(o["order_id"] != data["order_id"] for o in hidden.json())


def test_lab_walk_in_stores_name_and_age_then_orders(client, lab_headers):
    r = client.post(
        "/api/v1/counter/lab/walk-in",
        json={
            "branch_id": 1,
            "name": "Walk-in Lab Daw Aye",
            "gender": "F",
            "age_years": 2,
            "age_months": 3,
            "age_days": 10,
            "phone": "09-777",
        },
        headers=lab_headers,
    )
    assert r.status_code == 200
    walkin = r.json()
    assert walkin["name"] == "Walk-in Lab Daw Aye"
    assert walkin["age_years"] == 2
    assert walkin["age_months"] == 3
    assert walkin["age_days"] == 10
    assert walkin["invoice_kind"] == "lab"

    blank = client.post("/api/v1/counter/lab/walk-in", json={"branch_id": 1, "name": "  "}, headers=lab_headers)
    assert blank.status_code == 400

    lab_items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    item = next(i for i in lab_items if i["sku"] == "LAB-P16")
    r = client.post(
        "/api/v1/counter/lab",
        json={
            "branch_id": 1,
            "patient_id": walkin["patient_id"],
            "invoice_id": walkin["invoice_id"],
            "item_id": item["id"],
        },
        headers=lab_headers,
    )
    assert r.status_code == 200
    assert r.json()["invoice_id"] == walkin["invoice_id"]

    detail = client.get(f"/api/v1/counter/lab-order/{r.json()['order_id']}", headers=lab_headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["patient_name"] == "Walk-in Lab Daw Aye"
    assert body["age_years"] == 2
    assert body["age_months"] == 3
    assert body["age_days"] == 10
    assert body["gender"] == "F"


def test_lab_order_consumes_linked_reagents(client, reception_headers, lab_headers, pharmacy_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Lab Reagent Patient")
    items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    widal = next(i for i in items if i["sku"] == "LAB-P09")
    assert len(widal["reagents"]) == 4
    assert {r["sku"] for r in widal["reagents"]} == {"LABS-SST", "LABS-WIDAL", "LABS-SLIDE", "LABS-TIP"}

    stock = client.get("/api/v1/inventory/items", params={"department": "lab"}, headers=pharmacy_headers).json()
    before = next(row["on_hand"] for row in stock if row["item"]["sku"] == "LABS-WIDAL")

    r = client.post(
        "/api/v1/counter/lab",
        json={"branch_id": 1, "patient_id": result["patient"]["id"], "item_id": widal["id"]},
        headers=lab_headers,
    )
    assert r.status_code == 200

    stock = client.get("/api/v1/inventory/items", params={"department": "lab"}, headers=pharmacy_headers).json()
    after = next(row["on_hand"] for row in stock if row["item"]["sku"] == "LABS-WIDAL")
    assert after == before - 1


def test_store_can_link_lab_reagent_to_tests_on_create_and_edit(client, pharmacy_headers):
    tests = client.get("/api/v1/inventory/lab-tests", headers=pharmacy_headers)
    assert tests.status_code == 200
    widal = next(t for t in tests.json() if t["sku"] == "LAB-P09")
    cbc = next(t for t in tests.json() if t["sku"] == "LAB-CBC")

    r = client.post(
        "/api/v1/inventory/medicines",
        json={
            "name": "Test Suite Reagent X",
            "sku": "LABS-TESTX",
            "department": "lab",
            "cost": 100,
            "min_stock": 5,
            "lab_tests": [
                {"test_item_id": widal["id"], "qty": 2},
                {"test_item_id": cbc["id"], "qty": 1},
            ],
        },
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    item_id = r.json()["id"]

    stock = client.get("/api/v1/inventory/items", params={"department": "lab"}, headers=pharmacy_headers)
    row = next(x for x in stock.json() if x["item"]["id"] == item_id)
    assert len(row["lab_tests"]) == 2
    assert {x["test_sku"] for x in row["lab_tests"]} == {"LAB-P09", "LAB-CBC"}

    r = client.patch(
        f"/api/v1/inventory/medicines/{item_id}",
        json={"lab_tests": [{"test_item_id": widal["id"], "qty": 1}]},
        headers=pharmacy_headers,
    )
    assert r.status_code == 200
    stock = client.get("/api/v1/inventory/items", params={"department": "lab"}, headers=pharmacy_headers)
    row = next(x for x in stock.json() if x["item"]["id"] == item_id)
    assert len(row["lab_tests"]) == 1
    assert row["lab_tests"][0]["qty"] == 1


def test_usg_order_bills_invoice(client, reception_headers, usg_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "USG Test Patient A")
    usg_items = client.get("/api/v1/counter/usg-items", headers=usg_headers).json()
    item = next(i for i in usg_items if i["sku"] == "USG-ABD")

    r = client.post(
        "/api/v1/counter/usg",
        json={"branch_id": 1, "patient_id": result["patient"]["id"], "item_id": item["id"]},
        headers=usg_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == result["total"] + item["price"]

    orders = client.get(
        "/api/v1/counter/radiology-orders",
        params={"branch_id": 1, "modality": "usg", "status": "all"},
        headers=usg_headers,
    ).json()
    assert any(o["order_id"] == r.json()["order_id"] for o in orders)

    history = client.get(
        "/api/v1/counter/usg/history",
        params={"branch_id": 1, "q": "USG Test Patient A", "exam": "Abdominal", "status": "ordered"},
        headers=usg_headers,
    )
    assert history.status_code == 200
    assert any(o["order_id"] == r.json()["order_id"] and o["exam_name"] == "Abdominal Ultrasound" for o in history.json())


def test_xray_order_bills_invoice_and_result_completes_it(client, reception_headers, xray_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Xray Test Patient A")
    xray_items = client.get("/api/v1/counter/xray-items", headers=xray_headers).json()
    item = next(i for i in xray_items if i["sku"] == "XRAY-CHEST")

    r = client.post(
        "/api/v1/counter/xray",
        json={"branch_id": 1, "patient_id": result["patient"]["id"], "item_id": item["id"]},
        headers=xray_headers,
    )
    assert r.status_code == 200
    order_id = r.json()["order_id"]

    r = client.patch(
        f"/api/v1/counter/radiology/{order_id}/result",
        json={"order_id": order_id, "findings": "No abnormality"},
        headers=xray_headers,
    )
    assert r.status_code == 200

    orders = client.get(
        "/api/v1/counter/radiology-orders",
        params={"branch_id": 1, "modality": "xray", "status": "all"},
        headers=xray_headers,
    ).json()
    order = next(o for o in orders if o["order_id"] == order_id)
    assert order["status"] == "completed"
    assert order["findings"] == "No abnormality"

    history = client.get(
        "/api/v1/counter/xray/history",
        params={"branch_id": 1, "q": "Xray Test Patient A", "status": "completed", "exam": "Chest"},
        headers=xray_headers,
    )
    assert history.status_code == 200
    assert any(o["order_id"] == order_id and o["exam_name"] == "Chest X-Ray" for o in history.json())

    hidden = client.get(
        "/api/v1/counter/xray/history",
        params={"branch_id": 1, "q": "Xray Test Patient A", "status": "ordered"},
        headers=xray_headers,
    )
    assert all(o["order_id"] != order_id for o in hidden.json())
