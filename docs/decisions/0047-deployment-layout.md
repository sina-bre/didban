# 0047 — Deployment layout, rolling restart and backups on one box

- Status: Accepted
- Date: 2026-11-01

## Context
Spec §14.2 asks for systemd units templated by port, Caddy (plus an Nginx sample), a deploy script
that migrates once and restarts two instances in turn, nightly `pg_dump -Fc` with retention and a
restore check; DoD 10 wants all of it executed once. Choices the spec leaves open: where code and
secrets live, who builds, how the proxy learns that an instance is going away, what a backup holds.

## Decision
- **Layout.** Releases in `/opt/didban/releases/<UTC stamp>`, `current` is a symlink switched
  atomically (`mv -T`); three are kept for rollback. The dashboard is copied to `/srv/didban/www`
  (new hashed assets first, `index.html` last, old assets kept 30 days for open tabs).
- **Users and secrets.** The API runs as `didban` (no shell, state dir `/var/lib/didban`). It reads
  `/etc/didban/api.env` (root:didban 0640, app role only). The migrator URL lives in
  `/etc/didban/migrator.env` (root 0600), used only by `deploy.mjs`, never by the service.
- **Build.** As `didban` with a clean environment (`env -i`), then the release is chowned to root,
  so the service user cannot change code that runs after the next restart. Migrations run as root
  with `node --env-file`, once, before the switch.
- **Health and drain.** Caddy checks `/api/v1/health/ready` every 2 s and retries refused dials on
  the other instance for 5 s. On SIGTERM the API turns `/ready` to 503 and keeps serving for
  `SHUTDOWN_DRAIN_MS` (5 s), then closes (main.ts handles signals, not Nest). Without the wait a
  rolling restart lost 2 of ~3 000 requests: Fastify answers 503 on kept-alive proxy connections
  as soon as it starts closing. `deploy.mjs` waits 5 s after each `/ready` before the next restart.
- **Headers at the edge.** HSTS, nosniff, Referrer-Policy, Permissions-Policy everywhere; the SPA
  gets CSP `default-src 'self'` with no inline exceptions (the build needs none), frame-ancestors
  none, COOP. No access log: it would persist raw client IPs (spec §12).
- **Backups.** `pg_dump -Fc` by the `postgres` user from a systemd timer (03:15, ±10 min),
  verified with `pg_restore --list` before it gets its final name, 14 days kept. `daily_salts` is
  dumped without data: salts are destroyed daily (spec §12) and a backup must not keep them.

## Consequences
Rollback = point `current` at the previous release and restart both instances (migrations are
expand/contract). The whole workspace is installed in each release (dev dependencies included,
~1 GB); `pnpm deploy --prod` per app is the slimming step if disk matters. Helmet on the API
(spec §12) is replaced by the proxy's headers; an API reached without the proxy has none, which
the 127.0.0.1 bind prevents. Revisit the drain if the proxy's health interval changes.
