# 0034 — Breakdown reports from events or visits

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 4b (spec §3.1, §10, catalog 23.2): pages (top, entry, exit, discovered, detail), sources,
geo, devices, events, properties. Some dimensions live only on `events` (region, city, screen,
language, properties); first-touch source and entry/exit pages live on `visits` (spec §9.3).

## Decision
Two generic queries in `breakdown-sql.ts`, both on the shared scope of ADR 0033 (`scope-sql.ts`):
`eventBreakdown` (visitors = distinct browser IDs, page views, events) for pages-by-route, geo,
devices, events and property values; `visitBreakdown` (visitors, visits, bounce, duration) for
sources and entry/exit pages. The dimension is a column picked from a per-endpoint map (never
user input), property keys are bound (`properties ->> $key`). Top N + 1 row decides `truncated`.
Coded columns are returned by name. Page detail reuses the totals query with hostname + route
filters and reads `scroll_depth` / `engaged_time` events, numeric values only.

## Consequences
Rows with the same counts sort by stored value (codes for channels). Geo and devices count browser
events only; events count both sources. Plans for these queries are recorded with the 10 M-event
dataset in Stage 4d (`docs/database.md`).
