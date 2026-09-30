#!/usr/bin/env python3
"""Backup for the local SQLite deployment (plain `uvicorn`, not Docker/Postgres —
see scripts/backup.sh for that one).

Copies backend/shwemuse.db to a timestamped snapshot using SQLite's own
backup API (sqlite3.Connection.backup), not a plain file copy — that API is
safe to run while the app is live, since a raw `cp` can grab a half-written
page if a write transaction is in progress at that instant. Backups older
than KEEP_DAYS are pruned so backend/backups/ doesn't grow forever.

Usage:
    python3 scripts/backup_sqlite.py

Env vars (all optional):
    DB_FILE     path to the live database (default backend/shwemuse.db)
    BACKUP_DIR  where to write snapshots (default backend/backups)
    KEEP_DAYS   delete snapshots older than this many days (default 14)
"""
import os
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_FILE = Path(os.environ.get("DB_FILE", ROOT / "backend" / "shwemuse.db"))
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", ROOT / "backend" / "backups"))
KEEP_DAYS = int(os.environ.get("KEEP_DAYS", "14"))


def main() -> None:
    if not DB_FILE.exists():
        print(f"No database file at {DB_FILE} — nothing to back up", file=sys.stderr)
        sys.exit(1)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"shwemuse_{ts}.db"

    print(f"Backing up {DB_FILE} -> {dest}")
    src = sqlite3.connect(str(DB_FILE))
    dst = sqlite3.connect(str(dest))
    with dst:
        src.backup(dst)
    src.close()
    dst.close()

    cutoff = time.time() - KEEP_DAYS * 86400
    kept = 0
    for f in sorted(BACKUP_DIR.glob("shwemuse_*.db")):
        if f.stat().st_mtime < cutoff:
            f.unlink()
            print(f"Pruned old backup {f.name}")
        else:
            kept += 1
    print(f"Done. {kept} backup(s) kept in {BACKUP_DIR}")


if __name__ == "__main__":
    main()
