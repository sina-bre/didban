# Deployment (one box, Linux or Windows, no containers)

Spec §14. Layout and reasons: ADR 0047; Linux + Windows tooling: ADR 0048. Files:
`deploy/systemd/`, `deploy/windows/` (WinSW), `deploy/caddy/Caddyfile`, `deploy/nginx/didban.conf`
(sample), `scripts/deploy.mjs`, `scripts/backup.mjs`, `scripts/restore-check.mjs`.

## Where the dashboard lives
A dedicated hostname (`https://analytics.<your-domain>`) serves the dashboard and the API; tracked
sites point the SDK at it. A subdomain of a tracked site (`analytics.heliumpark.ir`) works, but
cookies the parent sets with `Domain=.heliumpark.ir` reach the analytics host too: prefer a
separate registrable domain or host-only cookies on the parent. A subpath (`site/analytics`) is
not supported. `http://<ip>:<port>` is for local smoke tests only (the API refuses it in production).

## Shared pieces
- **Database:** PostgreSQL 16+ on localhost. Roles `analytics_migrator` (DDL) and `analytics_app`
  (DML, `statement_timeout 15s`, `idle_in_transaction_session_timeout 30s`, `lock_timeout 5s`),
  long random passwords, database `didban` owned by the migrator, then
  `psql -d didban -f scripts/sql/dev-db-grants.sql` as a superuser (schema owner, app grants).
- **api.env** (every variable of `.env.example` except `PORT`, which each instance gets):
  `PUBLIC_ORIGIN=https://analytics.example.com`, `SESSION_COOKIE=secure`, `TRUST_PROXY=1`,
  `DATABASE_URL=postgresql://analytics_app:…@127.0.0.1:5432/didban`. The service sets
  `NODE_ENV=production`. **migrator.env:** only `MIGRATION_DATABASE_URL=…analytics_migrator…`.
- **Caddy:** the same `Caddyfile` on both systems, configured by `DIDBAN_HOST`, `DIDBAN_TLS`
  (ACME email, or `internal`) and, on Windows, `DIDBAN_WWW`. Then `node scripts/deploy.mjs` and the
  first owner: `node --env-file=<api.env> dist/cli/cli.js create-owner` in `current/apps/api`.

## Linux (Ubuntu LTS), as root
1. Packages: PostgreSQL (PGDG for 18), Node 24 (NodeSource), Caddy (its apt repo), `corepack enable`.
2. `useradd --system --home-dir /var/lib/didban --create-home --shell /usr/sbin/nologin didban`;
   `install -d -m 0755 /opt/didban/releases /srv/didban/www`; `install -d -m 0750 -o root -g didban
   /etc/didban`; `install -d -m 0700 -o postgres -g postgres /var/backups/didban`;
   `git clone <repo> /opt/didban/src`.
3. `/etc/didban/api.env` root:didban 0640, `/etc/didban/migrator.env` root 0600.
4. `cp deploy/systemd/{analytics-api@.service,didban-backup.*} /etc/systemd/system/`,
   `cp deploy/caddy/Caddyfile /etc/caddy/`, `systemctl edit caddy` →
   `[Service] Environment=DIDBAN_HOST=analytics.example.com DIDBAN_TLS=ops@example.com`,
   `systemctl daemon-reload`, `systemctl enable analytics-api@5101 analytics-api@5102 didban-backup.timer`.
5. `node /opt/didban/src/scripts/deploy.mjs`, `systemctl restart caddy`.
- Firewall: `ufw default deny incoming; ufw allow OpenSSH; ufw allow 80,443/tcp; ufw allow 443/udp`.
  Logs: journald (`journalctl -u analytics-api@5101`), size via `SystemMaxUse=`.

## Windows (Server 2022+ or 10/11), elevated PowerShell
1. Install PostgreSQL (EDB installer), Node 24 LTS, `corepack enable`, Git. Download `caddy.exe`
   (caddyserver.com) and `WinSW-x64.exe` (github.com/winsw/winsw releases).
2. Folders: `C:\didban\{releases,www,config,logs,backups,caddy}`, `git clone <repo> C:\didban\src`.
   ACLs: `icacls C:\didban\config /inheritance:r /grant:r Administrators:F "NT AUTHORITY\LocalService:R"`
   and `migrator.env` readable by Administrators only; LocalService gets read on `C:\didban` and
   modify on `C:\didban\logs`.
3. Services: copy `WinSW-x64.exe` to `C:\didban\analytics-api-5101.exe` (and `-5102`, `caddy-svc.exe`)
   next to the matching XML from `deploy/windows/` (`caddy.xml` → `caddy-svc.xml`, set
   `DIDBAN_HOST`/`DIDBAN_TLS` there; Caddyfile to `C:\didban\config\`), then `.\<name>.exe install`.
4. `node C:\didban\src\scripts\deploy.mjs` (restarts the two services in turn), `Start-Service caddy`.
5. Backup: `C:\didban\config\backup.env` (`PGHOST=127.0.0.1`, `PGUSER=analytics_migrator`,
   `PGPASSWORD=…`, `PG_BIN=C:\Program Files\PostgreSQL\18\bin`, Administrators only), then
   `schtasks /Create /TN DidbanBackup /SC DAILY /ST 03:15 /RU SYSTEM /TR "node --env-file=C:\didban\config\backup.env C:\didban\current\scripts\backup.mjs"`.
- Firewall: allow inbound 80/443 only; PostgreSQL `listen_addresses = 'localhost'`.

## Deploying a new version (both)
`git pull` in the source checkout, then `node scripts/deploy.mjs` (root / elevated): build a
release, migrate once, switch `current`, publish the dashboard, restart 5101, wait for `/ready`,
wait 5 s, restart 5102. A failed build or migration leaves nothing behind; a failed `/ready` stops
before the second instance. **Rollback:** point `current` at the previous release (`ln -sfn` +
`mv -T` on Linux, remove + `mklink /J` on Windows), copy its `apps/dashboard/dist` to the web
root, restart both instances one after the other. Migrations are expand/contract.

## Operations
- **GeoIP:** `GeoLite2-City.mmdb` (free MaxMind account) in `/var/lib/didban/` or `C:\didban\`,
  set `GEOIP_DB_PATH`, restart both in turn; refresh monthly the same way.
- **Secrets:** rotate DB passwords with `ALTER ROLE … PASSWORD`, update the env file, restart in
  turn. There is no `ENCRYPTION_KEY` yet (no stored TOTP secrets); rotation steps come with it.
- **Backups:** nightly `pg_dump -Fc`, verified, 14 days kept, salts excluded. Copy the backup
  folder off the box. Monthly: `restore-check.mjs` (Linux: `sudo -u postgres node …`; Windows:
  `node --env-file=…\backup.env …`, with `DIDBAN_SCRATCH_DB` if the role lacks CREATEDB), then
  record the date below.
- **Metrics:** set `METRICS_TOKEN` (≥ 32 chars) in the env file; Prometheus on the box scrapes
  `127.0.0.1:5101/metrics` and `:5102` with `authorization: { credentials_file: … }` (the proxy
  never forwards `/metrics`, ADR 0049). Alerts and runbooks: `docs/operations.md`.

## Validation record
**2026-11-01, Stage 6b, Linux:** clean Ubuntu 24.04.5 LTS in WSL2 (systemd on; 6 vCPU, 7.7 GB),
PostgreSQL 18.6 (PGDG), Node 24.22.2, Caddy 2.11.7 (`tls internal`, h2), two instances, the
files above unchanged. Owner via the CLI, one project, events through the real ingest endpoint.
- First deploy 2 m 47 s (14 migrations by the migrator role). `systemd-analyze security`: 1.3 OK.
  Caddy: HTTP/2, SPA fallback, CSP and the other headers present.
- Rolling deploy under traffic (2 ingest + 2 stats clients, 300 s): first run lost 2 of ~3 000
  requests (503 "server is closing" on kept-alive proxy connections), fixed by the drain
  (ADR 0047); then 4 136 of 4 136 OK with bash, and with `deploy.mjs` 0 errors during restarts
  (2 ingest 503s during the build, the 5 s lock/timeout path under CPU starvation; the SDK retries).
  Each instance stops in 5.2–5.3 s (drain + close).
- Graceful shutdown with a running deletion (`JOB_DELETE_CHUNK=100`): SIGTERM to the instance
  holding the job at 8 200 events deleted, stopped in 5.16 s, request left `running`; the other
  instance resumed on its next tick and finished: `done`, 32 128 events, 35 visits.
- A WSL VM crash (host memory) corrupted the source clone mid-pull: the new build's instance
  exited at start; the deploy (then bash) stopped before instance B, which kept serving. Rollback
  as documented: previous release back in ~10 s.
- `didban-backup.service`: 372 KiB dump, listed, retention removed a 20-day-old copy.
  **Restore check OK 2026-11-01:** 0.7 s, every count equal to live, `daily_salts` 0 (live 1),
  scratch database dropped.

**2026-11-01, Windows 10 (this dev box, PostgreSQL 18, no admin rights):** `deploy.mjs` twice
with `DIDBAN_RESTART` (no services: installing them needs admin): build, migrate, junction
`current` switched, dashboard published, both instances `/ready`. `backup.mjs` (66 KiB,
retention removed a 20-day-old dump) and `restore-check.mjs` into an existing scratch database
(`DIDBAN_SCRATCH_DB`): OK. **Not run on Windows:** the WinSW services (graceful Ctrl-C stop),
Caddy as a service and Task Scheduler; the files are in `deploy/windows/`, to be run once by an
administrator and recorded here.
