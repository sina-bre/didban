# 0028 — Identity, visit resolution and the event writer

- Status: Accepted
- Date: 2026-10-18

## Context
Spec §4 (identity modes, visits), §6.2 (server keys, visitors per batch), §7 steps 7–8 and §9.1–9.3
define how a validated, enriched batch becomes rows. A `200` must mean "committed" (§6.4), and a
retried batch must not count twice. Before this, valid batches got `503` (ADR 0025).

## Decision
- **Identity** (`identify-batch.ts`, `domain/visitor-id.ts`): every visitor ID is the first 16 bytes
  of SHA-256 over a label, the project ID and one identifier, NUL-separated. Cookieless: daily salt
  ‖ project ‖ IP ‖ trimmed, lowercased UA (≤ 512 chars). Persistent: the SDK's `anonymousId`; when it
  is missing (no consent yet) the cookieless hash is used. Server events: `anonymousId` (joins the
  browser visitor in persistent mode), else `userId`; neither → event rejected `INVALID_EVENT`,
  path `userId`. `allow_identify` off: `user_id` is not stored and browser `identify` events are
  dropped (counted as accepted, diagnostics `IDENTIFY_DISABLED`). More than 5 distinct visitors in a
  browser batch → `400 TOO_MANY_VISITORS_IN_BATCH`.
- **Daily salt** (`daily_salts`): 32 random bytes per UTC day, created by the first process that
  needs it (`ON CONFLICT DO NOTHING`, then read). That insert deletes salts older than yesterday.
  The salt day is the **receive** day, so one batch has one salt.
- **Write** (`modules/events`, the `EventWriter` boundary): one transaction, `statement_timeout 5s`.
  Advisory lock per distinct visitor (`hashtextextended(project_id ‖ visitor hex, 0)`, sorted). One
  query reads the visitors' visits overlapping the batch span ± timeout (≤ 200 rows), events are
  assigned in memory (`domain/assign-visits.ts`): join the first window [start − timeout, last +
  timeout] that contains the event, else start a UUIDv7 visit. Then a chunked `INSERT … ON CONFLICT
  DO NOTHING RETURNING event_id` (`INGEST_INSERT_CHUNK`, default 500). Visits, `pages_seen` and
  `project_usage_daily` are derived **only from inserted rows**. Same event ID twice in one batch is
  one duplicate. ULIDs map to the UUID with the same 128 bits.
- Visit merge: counts add, window widens, the earlier start keeps entry page + first-touch
  attribution, the later end sets the exit page. Device/country come from the first row.
- `pages_seen`: soft cap 10 000 per project, checked only when the batch has unseen routes; past
  it new routes become `/__other__` (diagnostics `PAGES_SEEN_OVERFLOW`). Upserts sort rows (lock order).
- Usage upsert goes last: it is the one row every batch of a project touches.
- Lock/statement timeouts, deadlocks, serialization and connection errors → `503` (SDK retries,
  dedupe makes it safe). Anything else → `500`, rolled back.

## Consequences
- EXPLAIN (ANALYZE, BUFFERS), test DB, 200 k visits / 20 k visitors, 10 k `pages_seen` rows:
  visit lookup 0.10 ms (Index Scan `visits_visitor_idx`, 15 buffers); known-route lookup 0.31 ms
  (Index Only Scan PK); cap count 1.6 ms (only on batches with new routes).
- A batch sent after 00:00 UTC hashes with the new day's salt even for events from before midnight.
- Concurrent batches can overshoot the `pages_seen` cap by a few rows (no lock; soft cap).
- Every batch of one project serializes briefly on its usage row. Revisit if the §16 load baseline
  shows it as the bottleneck (e.g. counters in memory, flushed like diagnostics).
- Not built yet: the 50 distinct property keys per (project, event name) limit (§6.2).
