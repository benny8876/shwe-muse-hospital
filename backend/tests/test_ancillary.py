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
