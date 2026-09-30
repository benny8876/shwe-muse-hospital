from tests.conftest import register_patient


def test_queue_dashboard_groups_by_doctor_and_tracks_wait(client, reception_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Queue Dashboard Patient")
    patient_id = result["patient"]["id"]

    r = client.get("/api/v1/queue-dashboard", params={"branch_id": 1}, headers=reception_headers)
    assert r.status_code == 200
    data = r.json()
    assert "tokens" in data
    assert "by_doctor" in data

    row = next((t for t in data["tokens"] if t["patient_id"] == patient_id), None)
    assert row is not None, "the newly registered patient should show up as waiting"
    assert row["status"] == "waiting"
    assert row["doctor_id"] == doctor_id
    assert row["waited_seconds"] >= 0

    doctor_bucket = next((b for b in data["by_doctor"] if b["doctor_name"] == row["doctor_name"]), None)
    assert doctor_bucket is not None
    assert doctor_bucket["waiting"] >= 1


def test_call_done_and_skip_transitions(client, reception_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Queue Transition Patient")
    patient_id = result["patient"]["id"]

    r = client.get("/api/v1/queue-dashboard", params={"branch_id": 1}, headers=reception_headers)
    row = next(t for t in r.json()["tokens"] if t["patient_id"] == patient_id)
    token_id = row["token_id"]

    r = client.patch(f"/api/v1/queue/{token_id}/call", headers=reception_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "serving"

    r = client.patch(f"/api/v1/queue/{token_id}/done", headers=reception_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "done"

    # a done token drops off the live dashboard
    r = client.get("/api/v1/queue-dashboard", params={"branch_id": 1}, headers=reception_headers)
    assert all(t["token_id"] != token_id for t in r.json()["tokens"])


def test_skip_token(client, reception_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Queue Skip Patient")
    patient_id = result["patient"]["id"]

    r = client.get("/api/v1/queue-dashboard", params={"branch_id": 1}, headers=reception_headers)
    row = next(t for t in r.json()["tokens"] if t["patient_id"] == patient_id)

    r = client.patch(f"/api/v1/queue/{row['token_id']}/skip", headers=reception_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "skipped"

    r = client.get("/api/v1/queue-dashboard", params={"branch_id": 1}, headers=reception_headers)
    assert all(t["token_id"] != row["token_id"] for t in r.json()["tokens"])
