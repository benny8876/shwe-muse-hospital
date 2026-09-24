import itertools

_counter = itertools.count()


def _unique_username(prefix: str) -> str:
    return f"{prefix}{next(_counter)}"


def test_non_admin_gets_403_on_every_admin_route(cashier_headers, client):
    username = _unique_username("blocked")
    assert client.get("/api/v1/admin/staff", headers=cashier_headers).status_code == 403
    assert client.post(
        "/api/v1/admin/staff",
        json={"username": username, "password": "Whatever@123", "full_name": "Blocked", "role": "nurse"},
        headers=cashier_headers,
    ).status_code == 403
    assert client.patch("/api/v1/admin/staff/1", json={"full_name": "x"}, headers=cashier_headers).status_code == 403
    assert client.post("/api/v1/admin/staff/1/reset-password", json={"new_password": "NewPass@123"}, headers=cashier_headers).status_code == 403


def test_create_staff_account_and_login(client, admin_headers):
    username = _unique_username("teststaff")
    r = client.post(
        "/api/v1/admin/staff",
        json={
            "username": username,
            "password": "TestPass@123",
            "full_name": "Test Staff",
            "role": "nurse",
            "branch_id": 1,
            "phone": "09-111222",
            "employee_code": "EMP-TEST",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    staff = r.json()
    assert staff["username"] == username
    assert "hashed_password" not in staff

    login = client.post("/api/v1/auth/login", data={"username": username, "password": "TestPass@123"})
    assert login.status_code == 200
    assert login.json()["home"] == "/counter/nurse"


def test_weak_password_rejected(client, admin_headers):
    r = client.post(
        "/api/v1/admin/staff",
        json={"username": _unique_username("weak"), "password": "123", "full_name": "Weak", "role": "nurse"},
        headers=admin_headers,
    )
    assert r.status_code == 400


def test_duplicate_username_rejected(client, admin_headers):
    username = _unique_username("dupe")
    payload = {"username": username, "password": "TestPass@123", "full_name": "Dupe", "role": "nurse"}
    assert client.post("/api/v1/admin/staff", json=payload, headers=admin_headers).status_code == 200
    r = client.post("/api/v1/admin/staff", json=payload, headers=admin_headers)
    assert r.status_code == 400


def test_deactivate_blocks_login_and_reactivate_restores_it(client, admin_headers):
    username = _unique_username("togglable")
    r = client.post(
        "/api/v1/admin/staff",
        json={"username": username, "password": "TestPass@123", "full_name": "Togglable", "role": "nurse"},
        headers=admin_headers,
    )
    staff_id = r.json()["id"]

    client.patch(f"/api/v1/admin/staff/{staff_id}", json={"is_active": False}, headers=admin_headers)
    r = client.post("/api/v1/auth/login", data={"username": username, "password": "TestPass@123"})
    assert r.status_code == 401

    client.patch(f"/api/v1/admin/staff/{staff_id}", json={"is_active": True}, headers=admin_headers)
    r = client.post("/api/v1/auth/login", data={"username": username, "password": "TestPass@123"})
    assert r.status_code == 200


def test_reset_password_lets_new_password_login(client, admin_headers):
    username = _unique_username("resettable")
    r = client.post(
        "/api/v1/admin/staff",
        json={"username": username, "password": "OldPass@123", "full_name": "Resettable", "role": "nurse"},
        headers=admin_headers,
    )
    staff_id = r.json()["id"]

    r = client.post(f"/api/v1/admin/staff/{staff_id}/reset-password", json={"new_password": "BrandNew@123"}, headers=admin_headers)
    assert r.status_code == 200

    assert client.post("/api/v1/auth/login", data={"username": username, "password": "OldPass@123"}).status_code == 401
    assert client.post("/api/v1/auth/login", data={"username": username, "password": "BrandNew@123"}).status_code == 200


def test_cannot_deactivate_admin_account(client, admin_headers):
    r = client.get("/api/v1/admin/staff", headers=admin_headers)
    super_admin = next(s for s in r.json() if s["role"] == "super_admin")
    r = client.patch(f"/api/v1/admin/staff/{super_admin['id']}", json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 400


def test_non_admin_gets_403_on_ward_routes(cashier_headers, client):
    assert client.get("/api/v1/admin/wards", params={"branch_id": 1}, headers=cashier_headers).status_code == 403
    assert client.post(
        "/api/v1/admin/wards",
        json={"branch_id": 1, "name": "Blocked Ward"},
        headers=cashier_headers,
    ).status_code == 403


def test_create_ward_and_bed_with_rates(client, admin_headers):
    ward_name = _unique_username("Test Ward")
    r = client.post(
        "/api/v1/admin/wards",
        json={"branch_id": 1, "name": ward_name, "category": "icu", "floor": "3"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    ward = r.json()
    assert ward["category"] == "icu"

    r = client.get("/api/v1/admin/wards", params={"branch_id": 1}, headers=admin_headers)
    assert any(w["id"] == ward["id"] for w in r.json())

    bed_code = _unique_username("BED")
    r = client.post(
        "/api/v1/admin/beds",
        json={"ward_id": ward["id"], "code": bed_code, "daily_rate": 10000, "hourly_rate": 1000, "package_rate": 50000},
        headers=admin_headers,
    )
    assert r.status_code == 200
    bed = r.json()
    assert bed["status"] == "available"
    assert bed["daily_rate"] == 10000

    r = client.get(f"/api/v1/admin/wards/{ward['id']}/beds", headers=admin_headers)
    assert any(b["id"] == bed["id"] for b in r.json())

    # duplicate bed code within the same ward is rejected
    r = client.post(
        "/api/v1/admin/beds",
        json={"ward_id": ward["id"], "code": bed_code},
        headers=admin_headers,
    )
    assert r.status_code == 400

    r = client.patch(f"/api/v1/admin/beds/{bed['id']}", json={"daily_rate": 12000}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["daily_rate"] == 12000


def test_non_admin_gets_403_on_create_branch(cashier_headers, client):
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": "BLOCKED", "name": "Blocked Branch"},
        headers=cashier_headers,
    )
    assert r.status_code == 403


def test_create_branch_appears_in_branch_list(client, admin_headers):
    code = _unique_username("BR")
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": code, "name": "Test Suite Branch 2", "name_mm": "ပူဆာင်", "phone": "09-999"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    branch = r.json()
    assert branch["code"] == code.upper()
    assert branch["name"] == "Test Suite Branch 2"

    r = client.get("/api/v1/admin/branches", headers=admin_headers)
    assert any(b["id"] == branch["id"] for b in r.json())

    # duplicate branch code is rejected
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": code, "name": "Duplicate"},
        headers=admin_headers,
    )
    assert r.status_code == 400

    r = client.patch(f"/api/v1/admin/branches/{branch['id']}", json={"name": "Renamed Branch"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Branch"
