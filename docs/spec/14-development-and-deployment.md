## 14. Development and deployment (no containers)

### 14.0 Where the dashboard lives (topologies)

- **Supported default: a dedicated hostname** (`https://analytics.<operator-domain>`) serving the dashboard and the API. Tracked sites (for example `heliumpark.ir` and any others) install the SDK pointing at it. All users sign in only on this host. The session cookie is host-only (`__Host-`), so it is never sent to a tracked site.
- **Operator uses a subdomain of a tracked site** (`analytics.heliumpark.ir`): supported as its own deployment on its own host. Warn in `docs/deployment.md`: cookies the parent site sets with `Domain=.heliumpark.ir` are also sent to the analytics host. Prefer a separate registrable domain, or make sure the parent site uses host-only cookies.
- **Subpath on a tracked site** (`heliumpark.ir/analytics`): **not supported.** It makes the dashboard same-origin with the tracked site, so any XSS on that site can drive the analytics session; it collides with the host app's cookies, CSP, headers and auth middleware; and it forces `base`/`basename` and deploy coupling. The only subpath use is the **ingestion proxy** from section 8.4.
- **IP and port** (`http://<ip>:<port>`): local development and first smoke tests only. The API refuses to start with `NODE_ENV=production` when the public origin is `http://` or an IP literal. A dev-only override flag is rejected in production.
- **Optional split later:** the same binary must be able to mount only ingestion routes or only management routes through configuration (`INSTANCE_ROLE=all|ingest|management`), so ingestion can be moved to its own hostname without code changes. Implement the switch; do not deploy a split until the trigger in section 20.

### 14.1 Local development
- Prerequisites: Node (version from `.nvmrc`), pnpm, PostgreSQL 16+ installed natively.
- `scripts/dev-db.mjs` creates the dev and test databases and the two roles idempotently.
- Commands (as `package.json` scripts): `pnpm dev` (API + dashboard), `pnpm db:migrate`, `pnpm db:seed` (development only, refuses to run when `NODE_ENV=production`), `pnpm db:reset` (drops and recreates dev DB only, with a confirmation prompt and a hard refusal against non-local hosts), `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm cli …`.
- `.env.example` with every variable, a comment for each, and no real values.

### 14.2 Production on one VPS
- `deploy/systemd/analytics-api@.service` (templated by port, so two instances can run for rolling restarts): dedicated non-root user, `EnvironmentFile`, `Restart=on-failure`, `KillSignal=SIGTERM`, `TimeoutStopSec=30`, and hardening (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths` limited to the log/GeoIP dirs).
- `deploy/caddy/Caddyfile`: TLS, static SPA with SPA fallback, `/api/*` reverse proxy with health checks across the instance ports, `trusted_proxies` where applicable, compression, security headers. Provide an equivalent Nginx sample.
- `scripts/deploy.sh`: build → run migrations **once** with the migrator role (never from API start-up, never per replica) → restart instance A → wait for `/ready` → restart instance B. Migrations follow expand/contract so the old version keeps working during the roll.
- **Backups:** `scripts/backup.sh` nightly `pg_dump -Fc` with retention; `scripts/restore-check.sh` restores into a scratch DB and runs sanity counts. Run it monthly, and record the date in `docs/deployment.md`. WAL archiving/PITR is added only on the trigger in section 20.
- Document: log rotation, firewall (only 80/443/SSH), PostgreSQL bound to localhost, GeoIP file refresh procedure, and key rotation (`ENCRYPTION_KEY` rotation steps for TOTP secrets).
