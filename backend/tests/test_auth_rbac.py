def test_login_success_returns_role_and_home(client):
    r = client.post("/api/v1/auth/login", data={"username": "cashier", "password": "ShweMuse@123"})
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "cashier"
    assert data["home"] == "/counter/cashier"
    assert "access_token" in data


def test_login_wrong_password_rejected(client):
    r = client.post("/api/v1/auth/login", data={"username": "cashier", "password": "WrongPassword1!"})
    assert r.status_code in (400, 401)


def test_non_admin_gets_403_on_admin_endpoint(cashier_headers, client):
    r = client.get("/api/v1/admin/staff", headers=cashier_headers)
    assert r.status_code == 403


def test_super_admin_bypasses_permission_checks(admin_headers, client):
    r = client.get("/api/v1/admin/staff", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_staff_list_never_leaks_password_hash(admin_headers, client):
    r = client.get("/api/v1/admin/staff", headers=admin_headers)
    assert r.status_code == 200
    for staff in r.json():
        assert "hashed_password" not in staff
