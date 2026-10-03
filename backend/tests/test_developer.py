"""Developer panel API — super_admin only, and since "dev1"/"dev2" are each
branch-local (see app/db/seed.py and app/api/v1/developer.py), scoped to the
acting account's own branch."""

DEMO_PASSWORD = "ShweMuse@123"


def test_super_admin_can_access_developer_meta(dev_headers, client):
    r = client.get("/api/v1/developer/meta", headers=dev_headers)
    assert r.status_code == 200
    data = r.json()
    assert "roles" in data
    assert "counters" in data
    assert "counter_tabs" in data
    assert any(c["key"] == "pharmacy" for c in data["counters"])
    assert "cashier.bills" in data["role_defaults"]["cashier"]["features"]
    assert "store" in data["role_defaults"]["cashier"]["counters"]


def test_hospital_admin_cannot_access_developer(client, dev_headers):
    r = client.post(
        "/api/v1/developer/users",
        headers=dev_headers,
        json={
            "username": "hospadmin_test",
            "password": DEMO_PASSWORD,
            "full_name": "Hospital Admin Test",
            "role": "hospital_admin",
            "allowed_counters": [],
            "extra_permissions": [],
        },
    )
    assert r.status_code == 200

    login = client.post("/api/v1/auth/login", data={"username": "hospadmin_test", "password": DEMO_PASSWORD})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/v1/developer/meta", headers=headers)
    assert r.status_code == 403


def test_owner_hospital_admin_cannot_access_developer(client, admin_headers):
    # "admin" is hospital_admin (Owner Panel only) since the branch-local
    # admin/developer split — it must not reach Developer Panel either.
    r = client.get("/api/v1/developer/meta", headers=admin_headers)
    assert r.status_code == 403


def test_create_user_with_custom_counters(dev_headers, client):
    username = "custom_lab_only"
    r = client.post(
        "/api/v1/developer/users",
        headers=dev_headers,
        json={
            "username": username,
            "password": DEMO_PASSWORD,
            "full_name": "Lab Only User",
            "role": "lab_tech",
            "allowed_counters": ["lab", "patient-records"],
            "allowed_features": ["lab.order", "lab.results", "patient-records.main"],
            "extra_permissions": [],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == username
    assert set(body["allowed_counters"]) == {"lab", "patient-records"}

    login = client.post("/api/v1/auth/login", data={"username": username, "password": DEMO_PASSWORD})
    assert login.status_code == 200
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert set(me.json()["allowed_counters"]) == {"lab", "patient-records"}


def test_update_user_permissions(dev_headers, client):
    create = client.post(
        "/api/v1/developer/users",
        headers=dev_headers,
        json={
            "username": "perm_user",
            "password": DEMO_PASSWORD,
            "full_name": "Perm User",
            "role": "cashier",
            "allowed_counters": ["cashier"],
            "allowed_features": ["cashier.bills", "cashier.stock"],
            "extra_permissions": ["billing.read"],
        },
    )
    assert create.status_code == 200
    user_id = create.json()["id"]

    patch = client.patch(
        f"/api/v1/developer/users/{user_id}",
        headers=dev_headers,
        json={
            "allowed_counters": ["cashier", "patient-records"],
            "allowed_features": ["cashier.bills", "cashier.stock", "patient-records.main"],
            "extra_permissions": ["billing.read", "inventory.read"],
        },
    )
    assert patch.status_code == 200
    assert set(patch.json()["allowed_counters"]) == {"cashier", "patient-records"}
    assert "inventory.read" in patch.json()["effective_permissions"]


def test_dev_account_is_scoped_to_its_own_branch(dev_headers, client, auth_headers):
    # dev1 (branch 1) must never see or touch branch 2's "admin2"/"dev2"/"cashier2".
    r = client.get("/api/v1/developer/users", headers=dev_headers)
    assert r.status_code == 200
    usernames = {u["username"] for u in r.json()}
    assert "admin1" in usernames  # sanity: own-branch accounts are still visible
    assert "admin2" not in usernames
    assert "dev2" not in usernames
    assert "cashier2" not in usernames

    # Creating a user forces branch_id to dev1's own branch regardless of what's sent.
    r = client.post(
        "/api/v1/developer/users",
        headers=dev_headers,
        json={
            "username": "sneaky_dev_create",
            "password": DEMO_PASSWORD,
            "full_name": "Sneaky",
            "role": "cashier",
            "branch_id": 999999,
            "allowed_counters": [],
            "extra_permissions": [],
        },
    )
    assert r.status_code == 200
    assert r.json()["branch_id"] != 999999

    # Cannot update or reset the password of a branch-2 account.
    dev2_headers = auth_headers("dev2")
    r = client.get("/api/v1/developer/users", headers=dev2_headers)
    admin2_id = next(u["id"] for u in r.json() if u["username"] == "admin2")

    r = client.patch(f"/api/v1/developer/users/{admin2_id}", headers=dev_headers, json={"full_name": "Hacked"})
    assert r.status_code == 403
    r = client.post(f"/api/v1/developer/users/{admin2_id}/reset-password", headers=dev_headers, json={"new_password": "Whatever@123"})
    assert r.status_code == 403
