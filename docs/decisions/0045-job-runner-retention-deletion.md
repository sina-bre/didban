# 0045 — Job runner, retention and data deletion

- Status: Accepted
- Date: 2026-11-01

## Context
Spec §9.4 asks for a nightly retention job (events in 10 000-row chunks with a short pause, then
visits, then expired auth sessions; logs rows and duration; advisory lock). §12 and §3.1 ask for
deletion by date range, visitor and user ID as a chunked job with a progress record; ADR 0043 left
the form out until this runner existed. §15 wants job last-success timestamps. §20 bans queues
until a trigger is measured, and the box may run two API instances during a rolling restart.

## Decision
- **In-process runner** (`modules/jobs`), mounted with the management modules (`INSTANCE_ROLE`
  `all|management`); `JOBS=off` turns it off (tests, and any box that should not run jobs). Every
  minute it takes a session-level `pg_try_advisory_lock` on a reserved connection; the holder works
  the open deletion requests, then runs retention if its last success is older than 23 h. A second
  instance skips the tick. No wall-clock schedule: "nightly" = once a day, starting a minute after
  the first boot.
- **`job_runs`** keeps last start, last success, last error, rows, duration per job (6c exports
  them as metrics). **`data_deletions`** is the request and its progress record: status,
  `cursor_at`, rows deleted. Each chunk and its counters commit together.
- **Retention:** per project with `retention_days`, events then visits older than the cutoff,
  then auth sessions past their absolute or 7-day idle limit, then diagnostics and rejected
  origins older than 14 days (catalog 23.2). Archived projects included.
- **Every event statement names one environment and one day window** (`events_range_idx` =
  project, environment, occurred_at): retention and deletions walk day × environment, 10 000 rows
  per statement, cursor saved per day. Measured: without the environment a day window or `min()`
  scanned the whole project (11–13 s), and an open-ended `occurred_at < cutoff` re-read the dead
  rows of earlier chunks until it hit the 15 s timeout.
  Range: events in `[from, to)` and visits started there. Visitor: the SDK's persistent
  `anonymousId` is hashed exactly like ingestion (`anonymousVisitorId`) and only the hash is
  stored; browser and server events with it, then its visits (`visits_visitor_idx`). User ID:
  events carrying it, then the visit rows (returning their bounds) and one bounded `DELETE` per
  visit for its other events (page views before `identify`); every join form, `LATERAL` included,
  was planned as a sequential-scan hash join (10–27 s). **No new index on `events`**: user/visitor
  deletions are rare and the windows keep
  each statement bounded, while an index on `user_id` or `visitor_id` would cost every insert.
- **API:** `GET|POST /projects/:id/deletions`, `project:manage` (spec §11), ≤ 10 open per project
  (`DELETION_LIMIT_REACHED`), audited as `data_deletion.requested` with the kind only (never the
  ID typed). Shutdown flips a flag checked before each chunk: the request stays `running` and
  resumes from its cursor. Any other error marks it `failed` with the message; the queue moves on.
- **Dashboard:** "Delete data" card on the Data page: date range as whole days in the project's
  zone (both included), anonymous ID or user ID, a confirmation dialog, the list polled every 5 s
  while a request is open.

## Evidence
`pnpm -C tools/load explain:jobs`, 1.8 M visits / ~8 M events (seed stopped early), PostgreSQL 18
defaults on the i5-8400 box; plans in `tools/load/results/job-plans-2026-11-01.md`:
- One chunk: retention events 26 ms, visitor day window 0.44 s, user day window 6.6 s (cold
  pages of a fresh table: 25 k reads), rest of one visit 0.3 ms, visitor's visits 8 ms.
- Real runs: retention cut **2 094 641 rows in 313 s**; user deletion over the whole span 120 s;
  visitor deletion 104 s. All statements under the 15 s app timeout.
- Open (6c): `min(occurred_at)` per environment took 12 ms on a vacuumed table but 12.9 s over
  the dead index entries of an earlier run. Autovacuum's default 20 % scale factor lets those
  pile up on `events`; per-table autovacuum settings go with the 6c load tests.

## Consequences
- Cookieless visitors cannot be deleted one by one: their daily salt is gone (by design); only a
  range deletion reaches them. Stated in the UI hint and the docs.
- A user deletion scans the project's whole span day by day: minutes on large projects, fine for a
  rare, background request. Revisit (partial index on `user_id`) if requests become frequent.
- Retention stays a chunked `DELETE` until the §20 trigger (retention > 30 min or > 50 M events)
  brings partitions and `DROP PARTITION`.
