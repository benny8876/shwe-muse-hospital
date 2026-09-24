# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Shwe Muse Hospital POS/HMS — a hospital management + point-of-sale system. Backend: FastAPI + SQLAlchemy (sync). Frontend: React 19 + Vite + Tailwind v4, UI text in Myanmar (default) and English via i18next.

## Commands

### Backend (`backend/`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
```bash
pytest                          # full backend test suite (backend/tests/)
pytest tests/test_billing.py -k test_pay_multi_full_payment_marks_invoice_paid   # single test
```
No lint/format command is configured for the backend.

### Frontend (`frontend/`)
```bash
npm install
npm run dev       # Vite dev server on :5173, proxies /api -> http://127.0.0.1:8001
npm run build      # tsc -b && vite build
npm run lint        # oxlint
npm run preview
```

### Docker (full stack)
```bash
docker compose up --build
```
Web UI on :8080, API on :8000 (note: the Docker Postgres setup uses different ports/DB than the local dev instructions above — see next section).

## Architecture

### Two database backends, switched by `DATABASE_URL`
- **Local dev** (`backend/app/core/config.py` default): SQLite at `backend/shwemuse.db`.
- **Docker** (`docker-compose.yml`): Postgres, `DATABASE_URL=postgresql+psycopg://...`.

`backend/app/db/session.py` picks sync `create_engine` based on the URL scheme; no async SQLAlchemy anywhere. All API routes are sync `def`, not `async def` — FastAPI runs them in a threadpool, so this is intentional, not an oversight.

### Backend tests (`backend/tests/`) run against an isolated SQLite file, never `shwemuse.db`
`tests/conftest.py` sets `DATABASE_URL` (and `SEED_ON_START`) as environment variables at the very top of the file, *before* any `app.*` import — `app/core/config.py`'s `settings` singleton and the `engine`/`SessionLocal` built from it (`app/db/session.py`) are only created once, at import time, so the env var must land first. The `client` fixture opens `TestClient(app)` as a context manager, which runs `app/main.py`'s `lifespan` (schema create + `seed()` + `ensure_extra_seed()`) against that isolated file — tests log in as the same seeded demo users used for manual testing (`receptionist`, `doctor1`, `pharmacy`, `lab`, `xray`, `usg`, `cashier`, `admin`, all password `ShweMuse@123`) rather than fabricating their own fixtures. Each test creates its own patient/invoice (see `register_patient()` in `conftest.py`) instead of depending on shared row IDs, so tests don't order-depend on each other.

### No Alembic migrations — schema evolves via two mechanisms
1. `Base.metadata.create_all()` on startup (`app/main.py` lifespan) creates any new tables.
2. `_ensure_schema()` in `app/main.py` does manual idempotent `ALTER TABLE` / data-backfill `text()` SQL for column additions to *existing* tables on a pre-existing SQLite file (new tables don't need this; new columns on tables that already shipped do). When adding a column to an existing model, add the matching `ALTER TABLE` there.

### Seed data: `seed()` vs `ensure_extra_seed()` (`app/db/seed.py`)
- `seed(db)` only runs its body if no `Branch` row exists yet (fresh DB) — full demo dataset (branch, users, patients, catalog items, wards/beds).
- `ensure_extra_seed(db)` runs unconditionally on every startup and idempotently top-ups an *existing* DB with rows added by later app versions (new demo logins, new catalog items) without touching existing data — check-then-insert by unique key (username/sku). When adding new demo users or catalog items, add them to both functions (or only to `ensure_extra_seed` if `seed` would also pick them up on a fresh DB).
- Both are invoked from the `lifespan` startup hook in `app/main.py` when `SEED_ON_START=true` (default).

### The "Counter" model is the actual app — most other frontend modules are dead code
`frontend/src/App.tsx` only routes a fixed set of `/counter/<name>` pages, each wrapped in `CounterGuard` (role check + demo-login hint screen) inside `CounterLayout` (role-filtered sidebar nav). The counters as of now: `reception`, `pharmacy`, `lab`, `xray`, `usg`, `nurse`, `ipd`, `store`, `cashier` — one per real-world hospital station, mapped from role → default landing page in `backend/app/core/rbac.py`'s `HOME_BY_ROLE`. `ipd` (`IpdBedsCounterPage.tsx`) is a nurse-facing, read-mostly ward/bed grid — deliberately a separate counter from `nurse` (`NurseCounterPage.tsx`, which owns vitals/nursing-notes) rather than another tab on it, so the two can grow independently; both are gated to the same `nurse`/`super_admin`/`hospital_admin` roles. It's backed by a single aggregate endpoint, `GET /ipd/dashboard`, which walks ward → bed → active admission → invoice so the bed-grid doesn't do N+1 requests per patient. Its "Tests / Exams Ordered" lines are clickable to open the actual Lab/X-ray/USG result, reusing the same components/correlation pattern as `PatientMedicalHistoryPanel.tsx`: `InvoiceLine` has no FK to `LabOrder`/`RadiologyOrder`, so `GET /ipd/dashboard` also returns each admission's `lab_orders`/`radiology_orders` (queried by `invoice_id`), and the frontend matches each line to an order id positionally (FIFO queue keyed by `LabOrder.tests` text / `RadiologyOrder.modality`) before rendering it as a button that opens `LabReportView`/`RadiologyReportView` in a `Modal`. `GET /counter/radiology/{order_id}` (mirroring the pre-existing `GET /counter/lab-order/{order_id}`) and `RadiologyReportView.tsx` (mirroring `LabReportView.tsx`) were added for this — `ResultSlip.tsx` gained a `readOnly` prop (same idea as `LabTemplateResult`'s) so it can render visibly in a view-modal instead of only in `.print-only` mode.

`frontend/src/modules/{frontdesk,opd,ipd,lab,radiology,inventory,hr,accounts,executive,emergency,ot,pos,portal,kiosk}/*.tsx` are **not routed anywhere** — earlier-generation pages kept in the tree but unreachable. Backend APIs for these areas may still be live and used by the counter pages (e.g. `/ipd/*`, `/inventory/*`) — don't assume an unrouted frontend module means the backend feature is unused.

### There is no digital "Doctor" counter — doctors use a paper notebook, not a computer
`frontend/src/modules/counters/DoctorCounterPage.tsx` and the backend `Prescription`/`PrescriptionItem` models + `doctor_examine`/`pending_prescriptions` endpoints in `counter_service.py`/`counters.py` still exist but are **intentionally unrouted/unused dead code**, same as the modules above. The real workflow: the doctor examines the patient and writes the diagnosis + drug orders by hand in a notebook while talking to the patient — no laptop. The patient (with the doctor's handwritten notes) is then physically routed by the nurse to whichever station is needed (X-ray/USG/Lab/Pharmacy), and *that station* enters the order directly into the POS when the patient arrives — via its own "active patients" (open-invoice) list, not from any digital order created by the doctor. Do not reintroduce a flow where Pharmacy (or any other counter) depends on a doctor-authored digital prescription; keep every counter's ordering independent, driven off `GET /counter/active-patients`, matching the X-ray/USG/Lab pattern.

### Nurse → Pharmacy ward medicine orders (`WardMedOrder`/`WardMedOrderItem`, `backend/app/api/v1/ward_orders.py`)
A deliberately separate, nurse-initiated queue for IPD patients — not a revival of the dead-code `Prescription` flow above. A nurse on `/counter/nurse` picks an admitted patient, searches the same `/inventory/items` catalog Pharmacy uses (nurse role was added to that endpoint's `require()` — read-only), and posts a `WardMedOrder` with one or more `WardMedOrderItem` rows (`status`: pending/dispensed/cancelled). Pharmacy sees every branch's pending items flattened into one queue via `GET /ward-orders/pending` (its own "Ward Orders" tab in `PharmacyCounterPage.tsx`, alongside Sale/Order History) and fulfills each item with `POST /ward-orders/items/{id}/dispense`, which calls the existing `pharmacy_charge()` service function — the same stock-decrement + `InvoiceLine` (`source="pharmacy"`) path a walk-in Sale-tab dispense uses, so it bills the patient's existing open invoice identically either way. Pharmacy's own direct patient-search dispense path is untouched and still works independently — this queue is an additional, optional input, not a dependency. A nurse can also cancel their own pending items without dispensing.

### `pay_invoice()`'s overpayment guard vs. IPD admission deposits (`backend/app/services/billing_service.py`)
`pay_invoice()` normally rejects a payment larger than the invoice's current balance (`amount > inv.balance`) — correct for a Cashier settling an already-itemized bill, since it catches typos/overcollection. An IPD admission deposit is different: it's an advance against a stay that hasn't been billed yet, and routinely exceeds the single day-one room-charge line posted at admit time (e.g. a round 200,000 MMK deposit vs. a 30,000 MMK daily rate) — the plain guard would reject the deposit and fail the whole admission. `pay_invoice()` takes an `allow_overpay: bool = False` param for exactly this case; only the two admission-deposit call sites (`counter_service.py`'s `_register_ipd()` and `ipd.py`'s `admit()`) pass `allow_overpay=True`. Don't pass it elsewhere — every other payment path (Cashier, pharmacy dispense) should keep the guard.

`recalc_invoice()` also treats an admission-linked invoice specially: normally `balance <= 0.01 and paid > 0.01` flips status to `"paid"` (a closed/settled state), but for an invoice with `admission_id` set whose `Admission.status != "discharged"`, that transition is skipped (falls through to `"partial"` instead) even when a deposit fully covers the charges billed so far — because more room/pharmacy/lab charges will keep accruing until discharge. This matters because *every* "open invoice" lookup across the app (`GET /counter/active-patients`, `get_open_invoice()`, every counter's dispense/order endpoint) filters `status IN (draft, open, partial)` — an invoice that flips to `"paid"` mid-stay becomes invisible everywhere and the patient can no longer be billed at any counter until discharge. If you ever see an admitted IPD patient mysteriously drop off a counter's patient list, check `Invoice.status` on their admission's invoice first.

### Two different print patterns for two different paper sizes
`components/ResultSlip.tsx` (Lab/X-ray/USG results) uses the static `.print-only`/`.no-print` CSS classes in `index.css` and prints on normal paper via a plain `window.print()`. `components/RegistrationLabel.tsx` (Reception's post-registration wristband label) is different on purpose: it's a small 80mm x 30mm sticker, not a full page, so it dynamically injects a `<style>` tag with `@page { size: 80mm 30mm; margin: 0 }` plus a "hide everything except this element" visibility rule *only* for the duration of that one print job, then removes it on the browser's `afterprint` event. Don't merge these two patterns — a permanent global `@page` override would force every other print in the app (the Lab/X-ray/USG result slips) onto a tiny label-sized page too.

### Backend request flow for a counter action
`frontend/src/modules/counters/*.tsx` → `backend/app/api/v1/counters.py` (`/counter/*` router) → `backend/app/services/counter_service.py`. Nearly every counter action follows the same shape: look up or create the patient's **open invoice** via `get_open_invoice()`, call `add_line()` (`billing_service.py`) to bill it, and return updated totals — so a "waiting patient" list on any counter page is really "patients with an open invoice for this branch" (`GET /counter/active-patients`). Follow this pattern (open-invoice lookup + `add_line`) rather than creating parallel billing paths when adding a new counter action.

### RBAC (`backend/app/core/rbac.py`)
`ROLES`, `PERMS` (role → allowed permission strings, `can()` does prefix matching so `"billing.read"` also satisfies a check for `"billing"`), and `HOME_BY_ROLE` (role → default route after login) are the single source of truth. `super_admin`/`hospital_admin` bypass all permission checks in `app/core/deps.py`'s `require()`. Frontend route guards (`CounterGuard` role lists in `App.tsx`) must be kept in sync with these — they are a separate, parallel authorization layer and not derived from the backend config.

`pharmacist` deliberately has the broad `"inventory"` permission (not just `"inventory.read"`), so Pharmacy can fully manage its own medicine stock (add/edit medicines, receive stock, add suppliers, request wastage) directly from `/counter/pharmacy`, in addition to Cashier's separate Stock tab which manages the same underlying `CatalogItem`/`StockBatch`/`Supplier` data — both counters intentionally operate on the same data, this isn't a duplicate/parallel system. Pharmacy screens **do** show `unit_price`/`amount` (in the medicine search results, "Current Order" table, and `GET /counter/pharmacy/history`) — a walk-in customer sometimes buys and pays for medicine directly at Pharmacy without a separate Cashier stop, so the pharmacist needs to quote a total. This is a deliberate exception to money generally being Cashier-facing elsewhere in the app; Pharmacy still can't *change* a price outside the dedicated qty-only line-edit endpoint (`PATCH /counter/pharmacy/lines/{id}`), which stays qty-only specifically so pharmacist access can't become a side door for editing `unit_price`. `PharmacyCounterPage.tsx`'s "Current Order" panel (Sale tab) reads `invoice.lines.filter(l => l.source === 'pharmacy')` from the already-fetched `GET /counter/patient/{id}/invoice` response — no separate endpoint — so `confirmOrder()` must re-fetch the full invoice (not just patch `total`/`balance` in place) after dispensing for that list to stay live.

`PharmacyCounterPage.tsx`'s Sale tab is a stage-then-confirm cart, not immediate-dispense-on-click: "+ Add" only pushes `{item_id, qty}` into local `cart` state (merging qty if the item's already staged) — it does not call the backend. "Current Order" renders `cart` (status `PENDING`, removable) followed by the invoice's already-billed pharmacy lines (status `DISPENSED`); only "Confirm & Dispense" actually calls `POST /counter/pharmacy` once per cart line (there's no batch-dispense endpoint), removing each line from `cart` as its call succeeds so a mid-order failure leaves only the not-yet-dispensed lines staged for retry, not the whole order. `cart` is cleared whenever the selected patient changes.

### Each counter page owns its content only — the page title/subtitle lives in the shared chrome
No counter page renders its own `<PageHeader title="Counter N — X" subtitle="...">` any more (that duplicated the "N · X" name `CounterLayout`'s top header bar already shows). Each counter's one-line description instead lives as `subtitle` on its entry in `frontend/src/lib/counterLinks.ts` (`COUNTER_LINKS`), and `CounterLayout.tsx` renders it next to the counter name in the header bar. When adding a new counter page, add its `subtitle` there — don't reintroduce a page-level `<PageHeader>` for the counter name/blurb. (`DoctorCounterPage.tsx` still has one — it's unrouted dead code, left alone.)

### Admin panel (`/admin/*`) is a separate, developer-only layer from the client-facing `/counter/*` app
`backend/app/api/v1/admin.py` endpoints are gated with `require("__admin__")` — no role's `PERMS` entry contains `"__admin__"`, so only `super_admin`/`hospital_admin` (which bypass `require()` entirely) can ever pass; this is the intended pattern for admin-only endpoints, not a bug to "fix" by adding the permission to other roles. Frontend mirrors this with `AdminOnly` in `App.tsx` gating `/admin/*` (mounted at `AdminLayout`, separate from `CounterLayout`) — hospital staff only ever get `/counter/*` role logins; `/admin/*` (Staff Accounts, and Ward & Bed Management) is for the developer/owner (or `hospital_admin`) only, reserved for infrequent structural setup rather than day-to-day counter work. Add new admin-only tooling under this same `/admin/*` + `require("__admin__")` pattern rather than exposing it through a counter page. Ward/Bed CRUD (`admin_service.py`'s `list_wards`/`create_ward`/`update_ward`/`list_beds`/`create_bed`/`update_bed`) is the admin-side counterpart to the read-only `GET /counter/wards`/`GET /counter/beds` used by Reception when admitting an IPD patient — bed `status` (`available`/`occupied`/`maintenance`) is deliberately not editable from the admin UI, since it's owned by the admit/discharge/transfer flow in `counter_service.py`/`ipd.py`.

### Billing/invoice model
`Invoice` has one-to-many `InvoiceLine`s; `recalc_invoice()` (`billing_service.py`) recomputes `subtotal`/`total`/`balance`/`status` from lines and payments and must be called after any line/payment mutation. Line prices are plain editable floats (`unit_price`, `discount`) — there is no fixed price-list enforcement at the line level, so per-patient overrides (e.g. a doctor's consultation fee) are done by editing the line directly (`PATCH /invoices/{id}/lines/{line_id}`), not by a separate discount/override mechanism.

### Catalog item `category` vs `department`
`CatalogItem.category` is the broad type (`drug`, `radiology`, `lab`, `consultation`, ...). `department` is a finer filter used to distinguish services within the same category for counter routing — e.g. `category="radiology"` items are split into X-ray vs USG counters by `department` (`"xray"` / `"usg"`). When adding new service types, check whether an existing category needs a new `department` value rather than a new category.

### Frontend design system (`frontend/src/index.css` + `frontend/src/components/`)
Visual styling is centralized, not per-page: `index.css` defines CSS-variable tokens (`--brand-*` blue scale, `--status-*` fixed status colors) and the base classes every page uses (`.card`, `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-sm`, `.input`, `.badge`, `.alert-*`). Prefer these classes/tokens over new hardcoded colors. Reusable presentational components live in `frontend/src/components/`: `Modal` (overlay+dialog), `Alert` (tone-based banner), `ToggleGroup` (segmented button choice), `StatCard` (metric tile), `SelectableCard` (clickable bordered "pick one" list/tile item — waiting patients, orders, catalog items), `Button` (thin `.btn` wrapper with `variant`/`size`), plus the existing `DataTable`/`Tabs`/`PageHeader`/`StatusBadge`. When a counter page needs a modal, banner, segmented toggle, stat tile, or selectable list item, use these instead of hand-rolling the Tailwind classes inline — that inline duplication is exactly what these components replaced. `frontend/src/modules/counters/DoctorCounterPage.tsx` is unrouted dead code (see the Doctor-counter section above) and is intentionally excluded from this design-system pass — don't "fix" its still-hardcoded colors as part of unrelated work.

**All of `.btn`/`.card`/`.input`/etc. in `index.css` must stay inside `@layer components { ... }`.** Tailwind v4's utility classes (`w-16`, `max-w-md`, ...) live in the `utilities` cascade layer; a plain unlayered rule like `.input { width: 100% }` beats *any* utility class regardless of source order — that's how CSS cascade layers work — so `className="input w-16"` would silently render full-width, not 4rem, with the override only "working" via an `!important` hack (`!w-16`). Wrapping these classes in `@layer components` restores the normal, expected Tailwind override order. If you ever see a one-off size/spacing utility on an element that also has `.btn`/`.card`/`.input` doing nothing, check this first before reaching for `!important`.

### Dashboard landing page (`frontend/src/pages/DashboardPage.tsx`)
After login, every role lands on `/counter` (an icon-grid Dashboard), not directly on their counter page — `LoginPage.tsx` always navigates to `/counter` regardless of the backend's per-role `home` field (that field is still returned by `POST /auth/login` and still used by `CounterGuard`'s "Go to My Counter" shortcut). The Dashboard renders one icon tile per counter the current role can access, plus an Admin Panel tile for `super_admin`/`hospital_admin`. Both the Dashboard and `CounterLayout`'s sidebar nav read from the single shared list `frontend/src/lib/counterLinks.ts` (`COUNTER_LINKS`) — add a new counter there once, not in two places.
