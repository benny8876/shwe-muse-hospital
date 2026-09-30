# Shwe Muse Hospital POS / HMS

Full Hospital Management System based on quotation `QUO-2026-HOSP-FULL-001`.

## Stack

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL
- **Frontend:** React + Vite + Tailwind + i18n (Myanmar / English)

## Quick start (local)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Docker

```bash
docker compose up --build
```

- Web UI: http://localhost:8080
- API docs: http://localhost:8000/docs

## Demo logins

| Username | Role | Password |
|---|---|---|
| admin | Super Admin | ShweMuse@123 |
| cashier | Cashier POS | ShweMuse@123 |
| receptionist | Front Desk | ShweMuse@123 |
| doctor | OPD Doctor | ShweMuse@123 |
| nurse | IPD Nurse | ShweMuse@123 |
| pharmacy | Pharmacist | ShweMuse@123 |
| lab | Lab Tech | ShweMuse@123 |
| accountant | Accounts | ShweMuse@123 |
| hr | HR | ShweMuse@123 |

## Modules included

- OPD Billing & Cashier POS (multi-payment, shift, Z-report)
- Patient UHID, appointments, queue kiosk
- IPD admission, beds, running bill, vitals/nursing
- Pharmacy inventory FEFO, PO, transfer, wastage, narcotics
- Lab, Radiology, OT, Emergency services billing
- Accounting ledger, AR/AP, petty cash, Excel export
- HR roster, attendance, commissions, audit trail
- AI analytics KPI (forecast, reorder, occupancy, peak hours)
- Patient portal (OTP demo: `123456`)
- SMS demo mode (logged to server console)

## Backup

**Local SQLite deployment** (plain `uvicorn`, no Docker — the default dev setup):

```bash
python3 scripts/backup_sqlite.py
```

Copies `backend/shwemuse.db` to a timestamped snapshot in `backend/backups/`
using SQLite's own backup API (safe to run while the app is live). Backups
older than 14 days are deleted automatically; override with `KEEP_DAYS=30`
etc. To run it automatically, add a cron entry on the server, e.g. nightly
at 2am:

```
0 2 * * * cd /path/to/shwe-muse-hospital && python3 scripts/backup_sqlite.py >> backend/backups/backup.log 2>&1
```

Since backups live on the same disk as the app, also copy `backend/backups/`
to another machine/drive periodically (rsync, scp, an external drive) — a
backup that dies with the server it's on doesn't protect against server loss.

**Docker Compose deployment** (Postgres):

```bash
./scripts/backup.sh
```

## Myanmar language

Use the language toggle in the sidebar. Default UI language is Myanmar.

---

# ရွှေမူး ဆေးရုံ POS / HMS

Quotation `QUO-2026-HOSP-FULL-001` အရ OPD, IPD, Pharmacy, Lab, Accounting, Analytics အားလုံး ပါဝင်ပါသည်။

- Cashier POS — ငွေပေးချေမှု Cash/KPay/Wave/KBZPay/Card
- Front Desk — UHID မှတ်ပုံတင်၊ Queue
- IPD — တင်ဝင်/လွှဲ/ဆင်းခွင့်၊ Running Bill
- Stock — FEFO, PO, Transfer, Wastage
- Patient Portal — OTP `123456` (demo)

Demo password အားလုံး: `ShweMuse@123`
