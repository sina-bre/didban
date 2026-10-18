# Database: stats query plans

`EXPLAIN (ANALYZE, BUFFERS)` of every stats query on the **10 M-event dataset** (spec §9.2, Stage 4
gate). Raw plans of every 90-day statement: `tools/load/results/plans-2026-10-18.md`.

## Dataset and box
- `pnpm -C tools/load seed:large` → one project, **10 081 634 events, 2 350 000 visits**, 90 days,
  ~1.5 M visitors, 200 pages, 1 % server purchases with revenue (EUR/USD), Europe/Berlin.
- Reference box of `docs/load-baseline.md` (i5-8400, 6 cores, PostgreSQL 18.4 **defaults**:
  `shared_buffers` 128 MB, `work_mem` 4 MB, 2 parallel workers per query). Freshly written table,
  so most reads come from disk. Production tuning is Stage 6.
- `pnpm -C tools/load explain [projectId]` runs the **built API use cases** (read-only
  transaction, 10 s timeout as in production), captures their exact statements through the
  postgres.js `debug` hook and explains each one. **`pnpm test` truncates the test DB**: seed
  after running tests, not before.

## Results (ms, end to end per use case; 10 s timeout)
| Use case | 7 d | 30 d | 90 d | 90 d before ADR 0037 |
|---|---|---|---|---|
| overview + previous period | 2 897 | 3 338 | 3 831 | 7 560 |
| overview, filter page / country + browser | | | 1 575 / 1 837 | 1 548 / 1 901 |
| time series (auto interval; hourly 7 d = 1 157) | 1 304 | 3 380 | 9 037 | timeout |
| pages top | 1 592 | | **timeout** | timeout |
| pages entry / discovered | | | 3 687 / 4 | 3 725 / 3 |
| sources channel / utm_source + page filter | | | 3 106 / 825 | 3 096 / 894 |
| geo country / devices browser | | | 7 992 / 5 900 | 8 563 / timeout |
| events / goals | | | 3 402 / 9 273 | 2 824 / 12 514 |
| event properties (keys, then values) | | | **timeout** | timeout |
| page detail (one page) | | | 10 982 (3 statements, each < 10 s) | timeout |
| realtime (30 min) / data health (7 d) | | | 31 / 4 924 | 27 / 4 961 |

## What the plans show
- Every 90-day query is a parallel seq scan of the project's rows (90 days = the whole table here);
  the scan itself is 0.6–1.9 s. Narrow ranges use `events_range_idx`; event reports use
  `events_name_idx`. No new index was needed.
- **Fixed (ADR 0037):** `count(DISTINCT visitor_id)` sorted all 10 M rows in one process (315 MB
  on disk). Now visitors are "group by visitor, then count", which runs in parallel. The planner
  also refused parallel plans for `date_trunc(…, tz)` groupings (it cannot estimate the group
  count): stats transactions set `parallel_setup_cost = parallel_tuple_cost = 0` locally.
- **Still above 10 s, documented** (the gate allows a measured plan):
  - *Top pages over 90 days*: 7.6 M page views → 7.5 M (page, visitor) groups; the parallel sort
    of those text keys spills ~375 MB and takes ~16 s. `work_mem` 64 MB does not help (CPU-bound).
  - *Event property keys over 90 days*: ~870 k heap fetches through `events_name_idx` on a cold
    table (~4.7 s) plus the key fan-out; ~7 s per statement warm, both statements > 10 s cold.
  - Both need ~110 k events/day **in one project** for 90 days. The answer is a §20 trigger
    (daily rollups of counts, or partitioning), not a bigger timeout. Until then the dashboard
    (Stage 5) must default to a 30-day range, where every measured query answers in < 3.5 s.
