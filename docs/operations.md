# Operations runbooks

Spec §15. Each runbook: **symptom → metric → query → fix**. Metrics come from `GET /metrics` on
each API instance (`127.0.0.1:5101`, `:5102`, bearer `METRICS_TOKEN`, ADR 0049; never through the
proxy). Queries run as the migrator or `postgres` role in `psql` on the box. Install and restart
steps: `docs/deployment.md`. PromQL below assumes a 5-minute `rate()` window.

## Metrics at a glance
| Area | Series |
|---|---|
| Ingestion | `didban_ingest_requests_total{status,code}`, `didban_ingest_request_duration_seconds`, `didban_ingest_events_total{outcome,code}`, `didban_ingest_filtered_total{code}`, `didban_ingest_batch_size`, `didban_ingest_unavailable_total{cause}` |
| Limits | `didban_rate_limit_rejections_total{bucket}`: `ingest_ip`, `ingest_key`, `ingest_quota`, `stats_project`, `login` |
| Database | `didban_db_transaction_duration_seconds{mode,outcome}`, `didban_db_pool_wait_seconds`, `didban_db_pool_transactions{state}` (active / waiting), `didban_db_pool_max` |
| Stats | `didban_stats_request_duration_seconds{endpoint,status}` (cache hits included) |
| Jobs | `didban_job_last_success_timestamp_seconds{job}`, `didban_job_last_started_timestamp_seconds{job}`, `didban_job_last_rows{job}`, `didban_job_failing{job}`, `didban_job_rows_deleted_total{job}` |
| Process | `process_resident_memory_bytes`, `nodejs_eventloop_lag_seconds`, `nodejs_heap_size_used_bytes` |

Suggested alerts: ingest 5xx ratio > 1 % for 5 min; p95 ingest latency > 0.5 s; pool waiting > 0
for 5 min; event-loop lag > 0.2 s; retention last success older than 26 h; `didban_job_failing` = 1;
disk > 80 %.

## Ingestion failures
- **Symptom:** SDK retries, Data Health shows `SERVICE_UNAVAILABLE`, events arrive late or not at all.
- **Metric:** `sum by (status, code) (rate(didban_ingest_requests_total[5m]))`. 503 →
  `didban_ingest_unavailable_total{cause}`: `57014` statement timeout (5 s), `55P03`/`40P01` lock
  or deadlock, `53300` too many connections, `CONNECT_TIMEOUT`/`ECONNREFUSED` database down.
  500 → the API log line `unhandled error` (request ID in the response).
- **Query:** `SELECT state, wait_event_type, count(*) FROM pg_stat_activity WHERE datname = 'didban' GROUP BY 1, 2;`
  and `SELECT pg_is_in_recovery(), now() - pg_postmaster_start_time();`
- **Fix:** a few 503s under CPU starvation (a build or backup on the same box) are expected and
  safe: the SDK retries and the event ID deduplicates (load-baseline "503 under starvation"). A
  steady 503 rate: see DB saturation. Database down: `systemctl status postgresql` / `Get-Service`.

## DB saturation
- **Symptom:** ingest and stats latency rise together; `/ready` flaps.
- **Metric:** `didban_db_pool_transactions{state="waiting"}` > 0 for minutes, `histogram_quantile(0.95, rate(didban_db_pool_wait_seconds_bucket[5m]))`,
  `didban_db_transaction_duration_seconds` p95 by `mode`.
- **Query:** `SELECT pid, now() - xact_start AS age, wait_event_type, wait_event, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' ORDER BY age DESC LIMIT 20;`
  Lock graph: `SELECT pid, pg_blocking_pids(pid), left(query, 60) FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`
- **Fix:** a long job chunk or report is visible by its query; `SELECT pg_cancel_backend(<pid>);`
  is safe (the job resumes, the stats request gets a 5xx). Pool too small for the load:
  raise `DB_POOL_MAX` (2 instances × pool ≤ `max_connections` − 10). CPU-bound API: add an
  `INSTANCE_ROLE=ingest` instance (docs/load-baseline.md bottleneck).

## Invalid-key spikes
- **Symptom:** many 401s; a site lost its key or someone is probing.
- **Metric:** `rate(didban_ingest_requests_total{code=~"INVALID_WRITE_KEY|WRITE_KEY_REVOKED"}[5m])`,
  `didban_ingest_requests_total{code="ORIGIN_NOT_ALLOWED"}`, `didban_rate_limit_rejections_total{bucket="ingest_ip"}`.
- **Query:** unknown keys never reach the database (no project to attach them to). Known keys:
  `SELECT code, sum(count) FROM ingestion_diagnostics WHERE hour > now() - interval '1 day' GROUP BY 1 ORDER BY 2 DESC;`
  and rejected origins: `SELECT day, origin, count FROM ingestion_rejected_origins ORDER BY day DESC, count DESC LIMIT 20;`
- **Fix:** a revoked key still deployed: issue a new key (Settings → Keys) and redeploy the site.
  A missing origin: add it to the environment. Probing from a few IPs: the per-IP limit (429)
  already caps it; block at the proxy if it persists. Rejections cost ~1 ms each (abusive scenario).

## Slow stats queries
- **Symptom:** dashboard spinners, 429 `stats_project` (3 queries per project at once, 2 s wait).
- **Metric:** `histogram_quantile(0.95, sum by (le, endpoint) (rate(didban_stats_request_duration_seconds_bucket[5m])))`,
  `didban_rate_limit_rejections_total{bucket="stats_project"}`.
- **Query:** find the statement (`pg_stat_activity` above, or `pg_stat_statements` if installed),
  then in `psql` as the app role: `BEGIN READ ONLY; SET LOCAL parallel_setup_cost = 0; SET LOCAL parallel_tuple_cost = 0; EXPLAIN (ANALYZE, BUFFERS) <statement>; ROLLBACK;`
  (the same settings as `read-stats.ts`). `pnpm -C tools/load explain` prints every report's plan on a seeded copy.
- **Fix:** a Seq Scan on `events` or many `Heap Fetches` → `VACUUM (ANALYZE) events;` and check
  autovacuum (Disk growth). Large ranges on 10 M+ events: ADR 0037 for the measured plans; a
  §20 trigger (rollups) when p95 stays above budget after vacuum.

## Job not running
- **Symptom:** old data not expiring, deletion requests stuck at `pending`/`running`.
- **Metric:** `time() - didban_job_last_success_timestamp_seconds{job="retention"} > 26*3600`,
  `didban_job_failing == 1`, `didban_job_last_started_timestamp_seconds` not moving.
- **Query:** `SELECT * FROM job_runs;` `SELECT id, kind, status, cursor_at, error FROM data_deletions WHERE status <> 'done' ORDER BY created_at;`
  Lock holder: `SELECT pid, application_name, state FROM pg_stat_activity WHERE pid IN (SELECT pid FROM pg_locks WHERE locktype = 'advisory');`
- **Fix:** `JOBS=off` on every management instance → set `on`. `last_error` names the failure;
  a stuck holder (rare): restart that instance, the other takes the lock within a minute.

## Disk growth
- **Symptom:** disk alert, backups growing faster than traffic.
- **Metric:** node exporter `node_filesystem_avail_bytes`; `didban_job_last_rows{job="retention"}`
  (0 for days with retention set = nothing expires).
- **Query:** `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)), n_live_tup, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;`
  and `SELECT id, retention_days FROM projects;` (NULL = kept forever).
- **Fix:** set retention on projects that need none forever; dead tuples piling up on `events` or
  `visits` → `VACUUM (ANALYZE)` (migration 0015 makes autovacuum run at 2 % dead rows there);
  space returns to the OS only with `VACUUM FULL` (locks the table: maintenance window) or
  `pg_repack`. Backups: 14 kept; move older ones off the box. WAL: check `archive_command` / slots.
