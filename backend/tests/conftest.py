"""
Shared pytest fixtures for the backend test suite.

IMPORTANT: DATABASE_URL is overridden to an isolated test SQLite file *before*
anything under `app.*` is imported, since `app/core/config.py`'s `settings`
singleton (and the `engine`/`SessionLocal` built from it in
`app/db/session.py`) are created once at import time. This guarantees tests
never touch the real dev DB (`backend/shwemuse.db`).
"""
import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parent.parent / "test_shwemuse.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SEED_ON_START"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEMO_PASSWORD = "ShweMuse@123"


@pytest.fixture(scope="session", autouse=True)
def _fresh_test_db():
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    yield
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture(scope="session")
def client(_fresh_test_db):
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def token(client):
    def _token(username: str, password: str = DEMO_PASSWORD) -> str:
        r = client.post("/api/v1/auth/login", data={"username": username, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]

    return _token


@pytest.fixture(scope="session")
def auth_headers(token):
    def _headers(username: str, password: str = DEMO_PASSWORD) -> dict:
        return {"Authorization": f"Bearer {token(username, password)}"}

    return _headers


@pytest.fixture(scope="session")
def admin_headers(auth_headers):
    return auth_headers("admin")


@pytest.fixture(scope="session")
def dev_headers(auth_headers):
    # "admin" is hospital_admin (Owner Panel only, see app/db/seed.py) —
    # "dev1" is the branch-local super_admin with Developer Panel access.
    return auth_headers("dev1")


@pytest.fixture(scope="session")
def cashier_headers(auth_headers):
    return auth_headers("cashier")


@pytest.fixture(scope="session")
def reception_headers(auth_headers):
    return auth_headers("receptionist")


@pytest.fixture(scope="session")
def pharmacy_headers(auth_headers):
    return auth_headers("pharmacy")


@pytest.fixture(scope="session")
def lab_headers(auth_headers):
    return auth_headers("lab")


@pytest.fixture(scope="session")
def xray_headers(auth_headers):
    return auth_headers("xray")


@pytest.fixture(scope="session")
def usg_headers(auth_headers):
    return auth_headers("usg")


@pytest.fixture(scope="session")
def doctor_id(client, reception_headers) -> int:
    r = client.get("/api/v1/doctors", headers=reception_headers)
    r.raise_for_status()
    doctors = r.json()
    assert doctors, "seed() should have created at least one doctor"
    return doctors[0]["id"]


def register_patient(client, reception_headers, doctor_id: int, name: str, branch_id: int = 1) -> dict:
    """Create a fresh OPD patient + open invoice via Reception, for test isolation."""
    r = client.post(
        "/api/v1/counter/reception",
        json={
            "branch_id": branch_id,
            "doctor_id": doctor_id,
            "name": name,
            "phone": "09-000-000",
            "gender": "F",
            "patient_type": "opd",
        },
        headers=reception_headers,
    )
    r.raise_for_status()
    return r.json()
