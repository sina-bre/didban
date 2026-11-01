# 0048 — Operations scripts for Linux and Windows

- Status: Accepted
- Date: 2026-11-01

## Context
Spec §14.2 names bash scripts (`deploy.sh`, `backup.sh`, `restore-check.sh`) and a Linux box.
The owner also runs Didban on Windows and wants API and dashboard to run on both without limits
(2026-11-01). Containers stay out (spec §2 locked decision, confirmed by the owner the same day:
on Windows they would run in a Linux VM anyway). The application code is already portable (Node,
PostgreSQL, a static dashboard); only the operations tooling was Linux-only.

## Decision
One implementation per script, in Node: `scripts/deploy.mjs`, `scripts/backup.mjs`,
`scripts/restore-check.mjs`, sharing `scripts/ops/run.mjs` (process helpers, `PG_BIN`) and
`scripts/ops/platform.mjs` (paths per OS, build user, `current` switch, service restart). They
replace the bash versions (a recorded deviation from the file names in spec §14.2).
- **Linux:** systemd `analytics-api@.service`, `didban-backup.timer`, Caddy from its apt repo.
  Root runs the deploy; the build runs as `didban`; the release is then root's (ADR 0047).
- **Windows:** WinSW services (`deploy/windows/analytics-api-510x.xml`, `caddy.xml`): MIT, one
  executable, configuration in XML, Ctrl-C on stop, runs as `NT AUTHORITY\LocalService`. The
  backup runs from Task Scheduler with `node --env-file=…\backup.env`. `current` is a directory
  junction (no admin or developer mode needed), switched by remove + create.
- **Graceful stop on both:** systemd sends SIGTERM, WinSW sends Ctrl-C (SIGINT); in production
  both drain for `SHUTDOWN_DRAIN_MS`. `DIDBAN_RESTART` (a command with `{port}`) replaces the
  service manager for anything else (pm2, a hand-rolled supervisor).
- `restore-check` creates and drops its scratch database, or reuses an existing empty one
  (`DIDBAN_SCRATCH_DB`) so a role without CREATEDB can run it.

## Consequences
Same commands and the same Caddyfile on both systems; the docs carry one section per OS for the
first install. Windows differences that remain: the `current` switch is not atomic (a few ms
without the junction, instances keep their already-loaded code), no `ProtectSystem`-style
sandbox (the service account and folder ACLs do that job), and stopping another process gracefully
needs a console control event, which only the service wrapper can send. Revisit if WinSW stops
being maintained (alternatives: Servy, NSSM).
