from sqlalchemy import inspect

from app.db.session import engine


def _indexed_columns(table: str) -> set[str]:
    insp = inspect(engine)
    cols = set()
    for idx in insp.get_indexes(table):
        cols.update(idx["column_names"])
    for uc in insp.get_unique_constraints(table):
        cols.update(uc["column_names"])
    return cols


def test_hot_path_foreign_keys_are_indexed(client):
    """Regression guard: these columns are filtered on in the app's hottest
    request paths (finding a patient's open invoice, loading an invoice's
    lines/payments, the IPD ward dashboard, etc.). Without an index each of
    those becomes a full table scan that gets slower as real operational
    history accumulates — invisible on the small seeded/test dataset, so
    this test checks schema shape directly rather than timing a query.
    `client` just ensures the app's lifespan (and therefore _ensure_schema())
    has already run against the test database."""
    expectations = {
        "invoices": {"patient_id", "branch_id", "status"},
        "invoice_lines": {"invoice_id"},
        "payments": {"invoice_id", "shift_id"},
        "lab_orders": {"patient_id", "invoice_id", "status"},
        "radiology_orders": {"patient_id", "invoice_id", "status"},
        "admissions": {"patient_id", "branch_id", "status"},
        "appointments": {"patient_id", "doctor_id", "status"},
        "visits": {"patient_id", "branch_id"},
    }
    for table, expected_cols in expectations.items():
        indexed = _indexed_columns(table)
        missing = expected_cols - indexed
        assert not missing, f"{table} is missing indexes on {missing} (has: {indexed})"
