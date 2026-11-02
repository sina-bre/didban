# 0050 — Per-table autovacuum on `events` and `visits`

- Status: Accepted
- Date: 2026-11-02

## Context
ADR 0045 left this open: after a large delete, the job runner's `min(occurred_at)` probe
(`event-span.ts`) took 12.9 s instead of 12 ms, walking dead index entries. Retention and data
deletion remove big slices of the oldest rows, which all sit at the low end of
`events_range_idx`. Autovacuum's default trigger is 50 + 20 % of the table's rows as dead tuples,
so a deletion below 20 % of the table is never vacuumed by autovacuum.

Measured with `pnpm -C tools/load vacuum:check` (5.1 M events from `seed:large 1200000` + earlier
rows = 6.1 M, 2.4 GB, PostgreSQL 18.4, cost delay 2 ms; log in
`tools/load/results/vacuum-check-2026-11-02.log`):

| Step | Probe (EXPLAIN ANALYZE) |
|---|---|
| after `VACUUM (ANALYZE)` | 2.3 ms, 5 buffers |
| right after deleting the oldest 12 days (690 158 rows, 11 %) | **280 123 ms, 1 231 725 buffers** |
| 4 min later, default settings: no autovacuum (677 k dead < 1.23 M threshold) | 3 171 ms (the first scan had marked most entries dead) |
| 2 % settings set at 14:23; autovacuum finished 14:30, dead tuples 0 | 0.2 ms, 7 buffers |

## Decision
Migration 0015 sets on `events` and `visits`: `autovacuum_vacuum_scale_factor = 0.02`,
`autovacuum_vacuum_insert_scale_factor = 0.05`, `autovacuum_analyze_scale_factor = 0.02`. The
server-wide cost limit is unchanged, so each run stays gentle (it finished ~7 min after the change on this table).

## Consequences
- After a retention or deletion run, the table is cleaned within minutes, not when 20 % of it is
  dead. On a 10 M-row table that is every ~200 000 dead rows.
- The first probe after a big delete can still be slow (it hit 280 s here, past the 15 s app
  statement timeout). The job then fails, records `last_error` and retries a minute later; each
  scan marks the entries it passes dead, and autovacuum finishes the cleanup. `didban_job_failing`
  shows it (docs/operations.md "Job not running").
- Revisit when a table passes ~100 M rows (fixed thresholds instead of a fraction) or when
  vacuum runs overlap heavy ingestion (raise `autovacuum_vacuum_cost_limit`).
