# Cloud Admin Panel deployment

This is the one-time, manual setup for hosting the Admin/Owner Panel on a
cloud server — reachable from a phone, independent of either branch's
offline/LAN server. Nothing here can be done by the assistant automatically:
it requires an account with a cloud provider and a domain name.

## What this is

A **third deployment of the exact same codebase**, using the existing
`docker-compose.yml` unchanged. It is not a special "admin-only" build — it's
the same Docker image, just:
- seeded with no demo hospital data (`SEED_ON_START=false`),
- given only admin/owner login(s), created once by hand,
- fed by each branch's nightly `scripts/push_sync.py` push instead of live
  POS traffic.

Because `allowed_counters` (see `backend/app/core/access.py`,
`frontend/src/components/CounterGuard.tsx`) is already per-user, an admin
account on this cloud instance naturally only ever sees `/admin/*` and
`/counter/ward-management` — there is nothing counter-staff-facing to
restrict beyond what already exists.

## Steps

1. **Provision a small VPS** (DigitalOcean/Linode/AWS Lightsail — 1-2 GB RAM
   is enough for this read-mostly workload) and point a domain/subdomain at
   its IP (e.g. `admin.yourhospital.com`).
2. **Copy the repo** to the VPS (`git clone` or `scp`), same as any other
   deployment of this project.
3. **Set environment variables** for the `api` service in `docker-compose.yml`
   (via a `.env` file next to it, or directly):
   - `SEED_ON_START=false` — no demo patients/invoices here.
   - `SECRET_KEY` — a real, unique secret (not the repo's dev default).
   - `SYNC_SHARED_KEY` — a long random string; this exact value also goes into
     `SYNC_SHARED_KEY` on **both** branch servers' `push_sync.py` environment.
   - `CORS_ORIGINS` — the public domain you set up (e.g.
     `https://admin.yourhospital.com`).
4. **Start it**: `docker compose up -d --build`.
5. **Create the branch rows and admin login** once, by hand, the same way the
   existing `seed()` would have (see `backend/app/db/seed.py` for the shape) —
   e.g. a short one-off Python script run inside the `api` container, or by
   temporarily enabling `SEED_ON_START=true` for the very first boot only,
   then flipping it back off and deleting any demo accounts it created that
   you don't want on this instance.
6. **HTTPS**: unlike the branch LANs (where `mkcert` was recommended earlier
   because there's no public DNS there), this VPS has a real domain, so a
   standard Let's Encrypt certificate works — add `certbot` (or a Caddy/nginx
   reverse proxy with automatic Let's Encrypt) in front of the `web` service's
   port 80, or swap in a managed load balancer with TLS termination if your
   provider offers one.
7. **On each branch server**, add a cron job to run `scripts/push_sync.py`
   nightly, with these env vars set:
   ```
   SYNC_CLOUD_URL=https://admin.yourhospital.com/api/v1/sync/push
   SYNC_SHARED_KEY=<the same value set in step 3>
   BRANCH_ID=1          # this branch's local branch id
   BRANCH_CODE=BR1      # matches what you want it labeled as on the cloud side
   PERIOD=day
   ```
   Example crontab line (adjust the backend venv path to match your branch's
   actual deployment):
   ```
   15 23 * * * cd /opt/shwe-muse/backend && . .venv/bin/activate && python3 ../scripts/push_sync.py >> /var/log/shwe-muse-sync.log 2>&1
   ```
8. Log into the cloud instance's Owner Panel and confirm both branches show
   up under "All Branches" after their first nightly push.
