def test_non_cashier_cannot_manage_service_catalog(lab_headers, client):
    r = client.post(
        "/api/v1/counter/services",
        json={"department": "lab", "name": "Sneaky Test", "price": 1000},
        headers=lab_headers,
    )
    assert r.status_code == 403


def test_cashier_can_create_hide_and_show_service_item(client, cashier_headers, lab_headers):
    r = client.post(
        "/api/v1/counter/services",
        json={"department": "lab", "name": "Test Suite Widal", "price": 6000},
        headers=cashier_headers,
    )
    assert r.status_code == 200
    item = r.json()
    assert item["is_active"] is True

    lab_items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    assert any(i["id"] == item["id"] for i in lab_items)

    r = client.patch(f"/api/v1/counter/services/{item['id']}", json={"is_active": False}, headers=cashier_headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    lab_items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    assert not any(i["id"] == item["id"] for i in lab_items)

    r = client.patch(f"/api/v1/counter/services/{item['id']}", json={"is_active": True}, headers=cashier_headers)
    assert r.status_code == 200

    lab_items = client.get("/api/v1/counter/lab-items", headers=lab_headers).json()
    assert any(i["id"] == item["id"] for i in lab_items)


def test_doctors_filter_by_specialty(client, cashier_headers):
    r = client.post(
        "/api/v1/counter/doctors",
        json={
            "full_name": "Dr. OG Demo",
            "consultation_fee": 12000,
            "specialty": "OG (Obstetrics & Gynecology)",
        },
        params={"branch_id": 1},
        headers=cashier_headers,
    )
    assert r.status_code == 200

    all_docs = client.get("/api/v1/doctors", headers=cashier_headers).json()
    og_docs = client.get(
        "/api/v1/doctors",
        params={"specialty": "OG (Obstetrics & Gynecology)"},
        headers=cashier_headers,
    ).json()
    assert len(og_docs) < len(all_docs)
    assert any(d["full_name"] == "Dr. OG Demo" for d in og_docs)


def test_empty_name_rejected(client, cashier_headers):
    r = client.post(
        "/api/v1/counter/services",
        json={"department": "xray", "name": "   ", "price": 1000},
        headers=cashier_headers,
    )
    assert r.status_code == 400
