def test_stock_pdf_export(client, admin_headers):
    r = client.get("/api/v1/inventory/items/export/pdf", headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


def test_expense_pdf_export(client, admin_headers):
    r = client.get("/api/v1/accounts/expenses/export/pdf", params={"branch_id": 1}, headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


def test_bill_history_pdf_export(client, admin_headers):
    r = client.get("/api/v1/counter/bill-history/export/pdf", params={"branch_id": 1}, headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


def test_analytics_pdf_export(client, admin_headers):
    r = client.get("/api/v1/counter/analytics/export/pdf", params={"branch_id": 1, "period": "month"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


def test_analytics_pdf_export_combined_all_branches(client, admin_headers):
    r = client.get("/api/v1/counter/analytics/export/pdf", params={"period": "month"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.content[:5] == b"%PDF-"
