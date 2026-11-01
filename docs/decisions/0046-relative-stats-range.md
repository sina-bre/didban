# 0046 — Stats queries take a relative range

- Status: Accepted
- Date: 2026-11-01

## Context
Overview missed the LCP budget (addendum A2, 2.5 s) in Stage 5f: 2.9–3.0 s in Lighthouse mobile
(ADR 0044, `docs/dashboard-performance.md`). Its LCP waits on a serial chain: JS → `GET project`
(only for the reporting zone, spec §3.1) → three stats reads → paint. The zone is needed only to
turn "the last 7 days" into UTC instants; the API already reads the zone for every stats query.

## Decision
Every `/projects/:id/stats/*` route and the share view accept `range=today|7d|30d|90d` instead of
`from`/`to`: whole days ending today in the project's reporting zone, resolved by the API. A
`RelativeRange` interceptor (after the guards, through the `AccessScope`) rewrites the query to
`from`/`to` before the usual Zod pipe; the share view resolves it with the shared project's zone.
`range` together with `from` or `to` is a 400. The zoned-day functions move to
`@didban/contracts` (one implementation for API and dashboard). The dashboard sends presets as
`range`; custom ranges still send instants. The Overview prefetch starts its three reports
together with the project instead of after it.

## Consequences
One round trip less before the Overview's data on every preset (the common case). Query keys for
presets no longer change at midnight: a tab left open past midnight shows yesterday's window until
its next refetch (the API's 15 s cache keys on the resolved instants, so it is never stale long).
Responses still carry `meta.from`/`meta.to`, so clients see the resolved window. Revisit if
presets grow beyond whole days (`range=24h`): that needs no zone and belongs in the same parser.
