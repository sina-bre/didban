# Deployment (one Ubuntu LTS box, no containers)

Spec §14. Layout and reasons: ADR 0047. Files: `deploy/systemd/`, `deploy/caddy/Caddyfile`,
`deploy/nginx/didban.conf` (sample), `scripts/deploy.sh`, `scripts/backup.sh`,
`scripts/restore-check.sh`.

## Where the dashboard lives
A dedicated hostname (`https://analytics.<your-domain>`) serves the dashboard and the API; tracked
sites point the SDK at it. A subdomain of a tracked site (`analytics.heliumpark.ir`) works, but
cookies the parent sets with `Domain=.heliumpark.ir` reach the analytics host too: prefer a
separate registrable domain or host-only cookies on the parent. A subpath (`site/analytics`) is
not supported. `http://<ip>:<port>` is for local smoke tests only (the API refuses it in production).

## First install (as root)
1. Packages: PostgreSQL 16+ (PGDG for 18), Node 24 (NodeSource), Caddy (its apt repo), `rsync`,
   then `corepack enable`. PostgreSQL listens on localhost only (Ubuntu's default).
2. User and directories:
   ```bash
   useradd --system --home-dir /var/lib/didban --create-home --shell /usr/sbin/nologin didban
   install -d -m 0755 /opt/didban/releases /srv/didban/www
   install -d -m 0750 -o root -g didban /etc/didban
   install -d -m 0700 -o postgres -g postgres /var/backups/didban
   git clone <repo> /opt/didban/src
   ```
3. Database: roles `analytics_migrator` (DDL) and `analytics_app` (DML, `statement_timeout 15s`,
   `idle_in_transaction_session_timeout 30s`, `lock_timeout 5s`) with long random passwords, the
   `didban` database owned by the migrator, then
   `sudo -u postgres psql -d didban -f /opt/didban/src/scripts/sql/dev-db-grants.sql`
   (schema owner, default privileges for the app role).
4. `/etc/didban/api.env` (root:didban 0640), every variable from `.env.example` except `PORT`:
   `NODE_ENV=production`, `PUBLIC_ORIGIN=https://analytics.example.com`, `SESSION_COOKIE=secure`,
   `TRUST_PROXY=1`, `DATABASE_URL=postgresql://analytics_app:…@127.0.0.1:5432/didban`.
   `/etc/didban/migrator.env` (root 0600): only `MIGRATION_DATABASE_URL=…analytics_migrator…`.
5. Units and proxy:
   ```bash
   cp /opt/didban/src/deploy/systemd/{analytics-api@.service,didban-backup.*} /etc/systemd/system/
   cp /opt/didban/src/deploy/caddy/Caddyfile /etc/caddy/Caddyfile
   systemctl edit caddy   # [Service] Environment=DIDBAN_HOST=analytics.example.com DIDBAN_TLS=ops@example.com
   systemctl daemon-reload
   systemctl enable analytics-api@5101 analytics-api@5102 didban-backup.timer
   ```
6. `cd /opt/didban/src && scripts/deploy.sh`, `systemctl restart caddy`, then the first owner:
   `cd /opt/didban/current/apps/api && sudo -u didban node --env-file=/etc/didban/api.env
   dist/cli/cli.js create-owner`.

## Deploying a new version
`git -C /opt/didban/src pull && /opt/didban/src/scripts/deploy.sh`: build a release as `didban`,
migrate once (migrator role), switch `current`, publish the dashboard, restart 5101, wait for
`/ready`, wait 5 s, restart 5102. A failed build leaves nothing behind; a failed `/ready` stops
before the second instance. **Rollback:** `ln -sfn /opt/didban/releases/<previous>
/opt/didban/current.next && mv -T /opt/didban/current.next /opt/didban/current`, restart both
instances one after the other, re-publish that release's `apps/dashboard/dist`.

## Operations
- **Logs:** journald (`journalctl -u analytics-api@5101`); size via `SystemMaxUse=` in
  `/etc/systemd/journald.conf`. No access log (raw IPs, spec §12).
- **Firewall:** `ufw default deny incoming; ufw allow OpenSSH; ufw allow 80,443/tcp; ufw enable`
  (443/udp too for HTTP/3). API ports and PostgreSQL stay on 127.0.0.1.
- **GeoIP:** put `GeoLite2-City.mmdb` (free MaxMind account) in `/var/lib/didban/`, set
  `GEOIP_DB_PATH`, restart both instances in turn. Refresh monthly the same way (`geoipupdate`
  can write there).
- **Secrets:** rotate DB passwords with `ALTER ROLE … PASSWORD`, update the env file, restart in
  turn. There is no `ENCRYPTION_KEY` yet (no stored TOTP secrets); rotation steps come with it.

## Backups and restore check
`didban-backup.timer` runs `scripts/backup.sh` nightly (`pg_dump -Fc`, verified, 14 days kept,
salts excluded) into `/var/backups/didban`: copy that directory off the box. Monthly:
`sudo -u postgres /opt/didban/current/scripts/restore-check.sh` and record the date below.

## Validation record
<!-- filled in by Stage 6b -->
