def _unique(prefix: str) -> str:
    import time
    return f"{prefix}{int(time.time() * 1000) % 1_000_000}"


def _make_branch_admin(client, admin_headers, auth_headers, branch_id: int) -> dict:
    username = _unique("bradmin")
    r = client.post(
        "/api/v1/admin/staff",
        json={
            "username": username,
            "password": "ShweMuse@123",
            "full_name": "Branch Admin Test",
            "role": "branch_admin",
            "branch_id": branch_id,
            "phone": "",
            "email": "",
            "employee_code": "",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return {"username": username, "headers": auth_headers(username)}


def test_branch_admin_sees_only_own_branch_staff(client, admin_headers, auth_headers):
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": _unique("BA"), "name": "Branch Admin Test Branch"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    branch_id = r.json()["id"]

    ba = _make_branch_admin(client, admin_headers, auth_headers, branch_id)

    r = client.get("/api/v1/admin/staff", headers=ba["headers"])
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    assert all(row["branch_id"] == branch_id for row in rows)
    assert any(row["username"] == ba["username"] for row in rows)


def test_branch_admin_create_staff_forces_own_branch_and_blocks_admin_roles(client, admin_headers, auth_headers):
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": _unique("BB"), "name": "Branch Admin Test Branch 2"},
        headers=admin_headers,
    )
    branch_id = r.json()["id"]
    other_branch_id = 1 if branch_id != 1 else 2

    ba = _make_branch_admin(client, admin_headers, auth_headers, branch_id)

    # Tries to create staff in a different branch — server must force it back to their own.
    r = client.post(
        "/api/v1/admin/staff",
        json={
            "username": _unique("sneaky"),
            "password": "ShweMuse@123",
            "full_name": "Sneaky Staff",
            "role": "cashier",
            "branch_id": other_branch_id,
            "phone": "",
            "email": "",
            "employee_code": "",
        },
        headers=ba["headers"],
    )
    assert r.status_code == 200
    assert r.json()["branch_id"] == branch_id

    # Cannot create an admin-tier account.
    r = client.post(
        "/api/v1/admin/staff",
        json={
            "username": _unique("escalate"),
            "password": "ShweMuse@123",
            "full_name": "Escalate",
            "role": "hospital_admin",
            "branch_id": branch_id,
            "phone": "",
            "email": "",
            "employee_code": "",
        },
        headers=ba["headers"],
    )
    assert r.status_code == 403


def test_branch_admin_cannot_touch_other_branch_or_admin_accounts(client, admin_headers, auth_headers):
    r = client.post(
        "/api/v1/admin/branches",
        json={"code": _unique("BC"), "name": "Branch Admin Test Branch 3"},
        headers=admin_headers,
    )
    branch_id = r.json()["id"]
    ba = _make_branch_admin(client, admin_headers, auth_headers, branch_id)

    # The global super_admin account — must be unreachable even if branch_id happened to match.
    r = client.get("/api/v1/admin/staff", headers=admin_headers)
    admin_user = next(u for u in r.json() if u["username"] == "admin")

    r = client.patch(f"/api/v1/admin/staff/{admin_user['id']}", json={"full_name": "Hacked"}, headers=ba["headers"])
    assert r.status_code == 403

    r = client.post(f"/api/v1/admin/staff/{admin_user['id']}/reset-password", json={"new_password": "Whatever@123"}, headers=ba["headers"])
    assert r.status_code == 403

    # A cashier in a *different* branch — also unreachable.
    r = client.get("/api/v1/admin/staff", headers=admin_headers)
    other_cashier = next(u for u in r.json() if u["username"] == "cashier")
    r = client.patch(f"/api/v1/admin/staff/{other_cashier['id']}", json={"full_name": "Hacked2"}, headers=ba["headers"])
    assert r.status_code == 403


def test_non_admin_cannot_reach_staff_endpoints(client, cashier_headers):
    r = client.get("/api/v1/admin/staff", headers=cashier_headers)
    assert r.status_code == 403
