# Database: stats query plans

`EXPLAIN (ANALYZE, BUFFERS)` of every stats query (spec §9.2, Stage 4 gate). Stage 4a numbers are
on the load-test project (191 400 SDK-shaped events, 4 998 visits, one environment, all in the
24 h range) on the reference box of `docs/load-baseline.md` (PostgreSQL 18.4 defaults,
`work_mem` 4 MB). The 10 M-event dataset (Stage 4d) replaces these numbers.

| Query (`apps/api/src/modules/analytics/count-sql.ts`) | Plan | Time |
|---|---|---|
| overview events, no filter | Seq Scan events → Sort (external merge, 6 MB on disk) → GroupAggregate | 138 ms |
| overview visits, `pathname:eq:/pricing` | Seq Scan visits ⨝ Hash (HashAggregate of matching events' `visit_id`) | 40 ms |
| time series events, hourly, Europe/Berlin | Seq Scan → Sort on (`date_trunc(hour, ts, tz)`, visitor_id), 7.5 MB on disk → GroupAggregate | 236 ms |

Reading the plans:
- Seq scans are right here: every row of the table belongs to the project and range. With
  several projects or a narrow range, `events_range_idx (project_id, environment_id,
  occurred_at)` serves `environment_id = ANY(…)` + the range (checked again on the 10 M set).
- The cost is `count(DISTINCT visitor_id)`: PostgreSQL sorts for it and spills past `work_mem`.
  Candidates for 4d, only if the 10 M plans need them: `count(*)` over a `SELECT DISTINCT`
  subquery (hash aggregate, no sort), or a larger `work_mem` for stats transactions only.
- No new index in 4a.
