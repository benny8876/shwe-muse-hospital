from datetime import datetime, timedelta

from tests.conftest import register_patient


def _future_slot(hours: int = 1) -> str:
    return (datetime.utcnow() + timedelta(hours=hours)).replace(microsecond=0).isoformat()


def test_book_list_and_update_appointment(client, reception_headers, doctor_id):
    result = register_patient(client, reception_headers, doctor_id, "Appointment Test Patient")
    patient_id = result["patient"]["id"]
    scheduled_at = _future_slot(50)

    r = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": 1,
            "scheduled_at": scheduled_at,
            "duration_minutes": 20,
            "notes": "Follow-up",
        },
        headers=reception_headers,
    )
    assert r.status_code == 200
    ap = r.json()
    assert ap["status"] == "booked"
    assert ap["duration_minutes"] == 20

    r = client.get("/api/v1/appointments", params={"branch_id": 1, "doctor_id": doctor_id}, headers=reception_headers)
    assert r.status_code == 200
    assert any(row["id"] == ap["id"] for row in r.json())

    r = client.patch(f"/api/v1/appointments/{ap['id']}", json={"status": "arrived"}, headers=reception_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "arrived"

    r = client.patch(f"/api/v1/appointments/{ap['id']}", json={"status": "not-a-real-status"}, headers=reception_headers)
    assert r.status_code == 400


def test_double_booking_same_doctor_is_rejected(client, reception_headers, doctor_id):
    p1 = register_patient(client, reception_headers, doctor_id, "Double Book Patient A")["patient"]["id"]
    p2 = register_patient(client, reception_headers, doctor_id, "Double Book Patient B")["patient"]["id"]
    scheduled_at = _future_slot(60)

    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p1, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": scheduled_at, "duration_minutes": 15},
        headers=reception_headers,
    )
    assert r.status_code == 200

    # same doctor, overlapping time -> rejected
    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p2, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": scheduled_at, "duration_minutes": 15},
        headers=reception_headers,
    )
    assert r.status_code == 409

    # non-overlapping slot for the same doctor -> allowed
    later = (datetime.fromisoformat(scheduled_at) + timedelta(minutes=30)).isoformat()
    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p2, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": later, "duration_minutes": 15},
        headers=reception_headers,
    )
    assert r.status_code == 200


def test_cancelled_appointment_does_not_block_rebooking(client, reception_headers, doctor_id):
    p1 = register_patient(client, reception_headers, doctor_id, "Cancel Rebook Patient A")["patient"]["id"]
    p2 = register_patient(client, reception_headers, doctor_id, "Cancel Rebook Patient B")["patient"]["id"]
    scheduled_at = _future_slot(70)

    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p1, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": scheduled_at},
        headers=reception_headers,
    )
    assert r.status_code == 200
    ap_id = r.json()["id"]

    r = client.patch(f"/api/v1/appointments/{ap_id}", json={"status": "cancelled"}, headers=reception_headers)
    assert r.status_code == 200

    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p2, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": scheduled_at},
        headers=reception_headers,
    )
    assert r.status_code == 200


def test_reschedule_into_a_conflict_is_rejected(client, reception_headers, doctor_id):
    p1 = register_patient(client, reception_headers, doctor_id, "Reschedule Patient A")["patient"]["id"]
    p2 = register_patient(client, reception_headers, doctor_id, "Reschedule Patient B")["patient"]["id"]
    slot_a = _future_slot(80)
    slot_b = (datetime.fromisoformat(slot_a) + timedelta(hours=1)).isoformat()

    ap_a = client.post(
        "/api/v1/appointments",
        json={"patient_id": p1, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": slot_a},
        headers=reception_headers,
    ).json()
    ap_b = client.post(
        "/api/v1/appointments",
        json={"patient_id": p2, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": slot_b},
        headers=reception_headers,
    ).json()

    r = client.patch(f"/api/v1/appointments/{ap_b['id']}", json={"scheduled_at": slot_a}, headers=reception_headers)
    assert r.status_code == 409

    # rescheduling an appointment to its own current slot must not conflict with itself
    r = client.patch(f"/api/v1/appointments/{ap_a['id']}", json={"scheduled_at": slot_a}, headers=reception_headers)
    assert r.status_code == 200


def test_non_reception_role_cannot_book_appointments(client, pharmacy_headers, reception_headers, doctor_id):
    p1 = register_patient(client, reception_headers, doctor_id, "RBAC Test Patient")["patient"]["id"]
    r = client.post(
        "/api/v1/appointments",
        json={"patient_id": p1, "doctor_id": doctor_id, "branch_id": 1, "scheduled_at": _future_slot(90)},
        headers=pharmacy_headers,
    )
    assert r.status_code == 403
