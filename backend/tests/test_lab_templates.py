def _sample_rows():
    return [
        {"kind": "section", "label": "Renal Panel"},
        {"kind": "row", "label": "Creatinine", "unit": "mg/dl", "reference_range": "0.6 - 1.3", "remark": ""},
        {"kind": "row", "label": "Urea", "unit": "mg/dL", "reference_range": "10 - 50", "remark": ""},
    ]


def test_create_list_get_lab_template(client, lab_headers):
    r = client.post(
        "/api/v1/lab-templates",
        json={"name": "Custom Renal Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": _sample_rows()},
        headers=lab_headers,
    )
    assert r.status_code == 200
    created = r.json()
    assert created["name"] == "Custom Renal Panel"
    tid = created["id"]

    r = client.get("/api/v1/lab-templates", headers=lab_headers)
    assert r.status_code == 200
    assert any(t["name"] == "Custom Renal Panel" and t["row_count"] == 3 for t in r.json())

    r = client.get(f"/api/v1/lab-templates/{tid}", headers=lab_headers)
    assert r.status_code == 200
    detail = r.json()
    assert len(detail["rows"]) == 3
    assert detail["rows"][0]["kind"] == "section"
    assert detail["rows"][1]["label"] == "Creatinine"


def test_lab_templates_full_listing_includes_rows(client, lab_headers):
    client.post(
        "/api/v1/lab-templates",
        json={"name": "Full Listing Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": _sample_rows()},
        headers=lab_headers,
    )
    r = client.get("/api/v1/lab-templates", params={"full": True}, headers=lab_headers)
    assert r.status_code == 200
    match = next(t for t in r.json() if t["name"] == "Full Listing Panel")
    assert len(match["rows"]) == 3
    assert match["rows"][1]["label"] == "Creatinine"


def test_lab_template_name_must_be_unique(client, lab_headers):
    payload = {"name": "Duplicate Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": _sample_rows()}
    r = client.post("/api/v1/lab-templates", json=payload, headers=lab_headers)
    assert r.status_code == 200
    r = client.post("/api/v1/lab-templates", json=payload, headers=lab_headers)
    assert r.status_code == 400


def test_lab_template_requires_name_and_rows(client, lab_headers):
    r = client.post("/api/v1/lab-templates", json={"name": "", "rows": _sample_rows()}, headers=lab_headers)
    assert r.status_code == 400
    r = client.post("/api/v1/lab-templates", json={"name": "Empty Rows Panel", "rows": []}, headers=lab_headers)
    assert r.status_code == 400


def test_update_lab_template_replaces_rows(client, lab_headers):
    r = client.post(
        "/api/v1/lab-templates",
        json={"name": "Editable Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": _sample_rows()},
        headers=lab_headers,
    )
    tid = r.json()["id"]

    new_rows = [{"kind": "row", "label": "Sodium", "unit": "mmol/L", "reference_range": "135 - 145", "remark": ""}]
    r = client.put(
        f"/api/v1/lab-templates/{tid}",
        json={"name": "Editable Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": new_rows},
        headers=lab_headers,
    )
    assert r.status_code == 200

    r = client.get(f"/api/v1/lab-templates/{tid}", headers=lab_headers)
    detail = r.json()
    assert len(detail["rows"]) == 1
    assert detail["rows"][0]["label"] == "Sodium"


def test_delete_lab_template(client, lab_headers):
    r = client.post(
        "/api/v1/lab-templates",
        json={"name": "Deletable Panel", "has_unit": True, "has_range": True, "has_remark": True, "rows": _sample_rows()},
        headers=lab_headers,
    )
    tid = r.json()["id"]

    r = client.delete(f"/api/v1/lab-templates/{tid}", headers=lab_headers)
    assert r.status_code == 200

    r = client.get(f"/api/v1/lab-templates/{tid}", headers=lab_headers)
    assert r.status_code == 404
