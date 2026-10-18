# 0033 — Stats queries: overview, time series, filters

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 4a (spec §4, §10, catalog 23.2): six overview KPIs, a time series in the project's
reporting time zone, previous-period (and previous-year) comparison, `field:op:value` filters.
Spec §10 query safety: allowlisted fields, bound values, 10 s statement timeout, ≤ 366 days.

## Decision
- `modules/analytics` (read-only): one SQL pair per range in `count-sql.ts` — events (visitors =
  distinct browser visitor IDs, page views) and visits (started in range; with filters only visits
  that contain a matching event). Overview = one total row; time series = the same SQL grouped by
  `date_trunc(unit, ts, tz)`, with the bucket list from `generate_series(…, tz)` (PostgreSQL ≥ 16,
  DST- and half-hour-zone-correct). Totals never sum buckets.
- Filters: grammar and allowlist in `@didban/contracts` (`parseFilter`, shared with the dashboard
  URL state); `filter-sql.ts` maps fields to columns, binds values (`ILIKE` with escaped wildcards,
  `IS DISTINCT FROM` for `neq`), property keys bound in `properties ->> $key`, coded columns by name.
- Every stats request runs in `BEGIN READ ONLY` with `SET LOCAL statement_timeout = '10s'`.
- `auto` interval ≤ 2 d hour, ≤ 92 d day, ≤ 183 d week, else month; ≤ 1000 buckets (400 above).
- `previous_year` (catalog v1+) shifts both instants one UTC calendar year.
- Bounce = `pageviews = 1 AND events = 1` on the visit (spec: one page view, zero other events).

## Consequences
Filters are event-level (a visit counts when any of its events matches all filters). The semaphore
and 15 s cache (spec §10) come in 4c; `count(DISTINCT)` spills to disk at 191 k rows
(`docs/database.md`), revisit with the 10 M-event plans in 4d.
