# 0037 — Stats queries on 10 M events: parallel plans and grouped distinct counts

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 4 gate: no stats query above its 10 s timeout on the 10 M-event dataset, or the slow ones
documented with a measured plan. First measurement (`docs/database.md`, "before" column): 5 of
23 use cases timed out at 90 days. Plans showed two causes, each measured in isolation:
`count(DISTINCT visitor_id)` = one single-process sort of 10 M rows spilling 315 MB (8.0 s;
"group by visitor, then count" = 3.5 s), and grouping by `date_trunc(…, tz)` planned without
parallel workers because the group count cannot be estimated (6.0 s; forced parallel 2.1 s).
A larger `work_mem` changed little (64 MB: 11.3 → 9.8 s) and costs memory per query.

## Decision
- Stats transactions (`readStats`) set `parallel_setup_cost = 0` and `parallel_tuple_cost = 0`
  with `SET LOCAL`: read-only analytic work only, no global setting, no new index.
- Distinct visitors are counted by grouping on the visitor first (`count(*) FROM (… GROUP BY
  visitor_id …)`) in totals/buckets, event breakdowns, top pages, goals, property keys and
  scroll depth. Semantics unchanged (the boundary and distinct-total tests still pass).
- Not done: approximate counts (spec: all counts exact), rollups of uniques (spec §9.4), a higher
  statement timeout. Top pages and property keys over 90 days of a 110 k-events/day project stay
  above 10 s on this box and are documented with their plans.

## Consequences
Up to `max_parallel_workers_per_gather` (2) extra workers per stats query; with ≤ 3 concurrent
stats queries per project (ADR 0035) and the server-wide `max_worker_processes` cap this is
bounded. Revisit at the §20 trigger (daily rollups of counts / partitioning) or with production
tuning in Stage 6 (`shared_buffers`, more parallel workers).
