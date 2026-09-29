"""Seed ~100 pharmacy medicines with stock for testing.

Run from backend/: python -m scripts.seed_pharmacy_test
"""

from __future__ import annotations

from app.db.demo_seed import ensure_pharmacy_demo_seed
from app.db.session import SessionLocal


def seed_pharmacy_test() -> None:
    db = SessionLocal()
    try:
        ensure_pharmacy_demo_seed(db)
        db.commit()
        print("Pharmacy demo seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_pharmacy_test()
