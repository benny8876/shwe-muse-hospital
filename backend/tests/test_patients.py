def test_patient_search_matches_all_terms_across_fields(client, reception_headers):
    r = client.post(
        "/api/v1/patients",
        json={"name": "Search Target Zzq", "father_name": "Unique Father Xkw", "phone": "09-111-2222"},
        headers=reception_headers,
    )
    r.raise_for_status()
    patient = r.json()

    # Multiple space-separated terms, each hitting a different field, must
    # all match (AND across terms) rather than only the first term winning.
    r = client.get(
        "/api/v1/patients",
        params={"q": f"{patient['uhid']} Xkw Zzq"},
        headers=reception_headers,
    )
    r.raise_for_status()
    ids = [p["id"] for p in r.json()]
    assert patient["id"] in ids

    # A term that matches no field at all must exclude the patient.
    r = client.get(
        "/api/v1/patients",
        params={"q": f"{patient['uhid']} NoSuchTermAtAll"},
        headers=reception_headers,
    )
    r.raise_for_status()
    ids = [p["id"] for p in r.json()]
    assert patient["id"] not in ids

    # Comma-separated terms (no space after the comma) must split too.
    r = client.get(
        "/api/v1/patients",
        params={"q": f"{patient['uhid']},Xkw"},
        headers=reception_headers,
    )
    r.raise_for_status()
    ids = [p["id"] for p in r.json()]
    assert patient["id"] in ids
