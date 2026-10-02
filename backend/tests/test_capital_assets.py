def test_create_list_and_delete_capital_asset(client, admin_headers):
    r = client.post(
        "/api/v1/admin/capital-assets",
        json={"branch_id": 1, "name": "Test Suite X-Ray Machine", "category": "Lab Equipment", "cost": 55_000_000, "notes": "pytest"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    asset = r.json()
    assert asset["name"] == "Test Suite X-Ray Machine"
    assert asset["cost"] == 55_000_000
    assert asset["branch_id"] == 1

    r = client.get("/api/v1/admin/capital-assets", params={"branch_id": 1}, headers=admin_headers)
    assert r.status_code == 200
    assert any(a["id"] == asset["id"] for a in r.json())

    r = client.delete(f"/api/v1/admin/capital-assets/{asset['id']}", headers=admin_headers)
    assert r.status_code == 200

    r = client.get("/api/v1/admin/capital-assets", params={"branch_id": 1}, headers=admin_headers)
    assert not any(a["id"] == asset["id"] for a in r.json())


def test_capital_asset_requires_positive_cost(client, admin_headers):
    r = client.post(
        "/api/v1/admin/capital-assets",
        json={"branch_id": 1, "name": "Free Thing", "cost": 0},
        headers=admin_headers,
    )
    assert r.status_code == 400


def test_non_admin_gets_403_on_capital_assets(client, cashier_headers):
    r = client.post(
        "/api/v1/admin/capital-assets",
        json={"branch_id": 1, "name": "Blocked Machine", "cost": 1000},
        headers=cashier_headers,
    )
    assert r.status_code == 403
