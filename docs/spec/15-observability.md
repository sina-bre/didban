## 15. Observability

- Endpoints: `GET /api/v1/health/live` (process up), `GET /api/v1/health/ready` (DB `SELECT 1` with a 2 s timeout, not-shutting-down), `GET /metrics` (Prometheus text via `prom-client`; bound to localhost or protected by a bearer token, never public).
- Metrics: ingestion requests by status, events accepted/duplicate/rejected by code, events dropped by filter (bot, internal, PII), batch size histogram, ingestion end-to-end latency histogram, DB transaction latency, pool in-use/waiting, rate-limit rejections by bucket, stats query latency by endpoint, retention rows deleted, job last-success timestamps, process memory/event-loop lag.
- `docs/operations.md` runbooks for: ingestion failures (symptom → metric → query → fix), DB saturation, invalid-key spikes, slow stats queries (using `EXPLAIN (ANALYZE, BUFFERS)`), job not running, disk growth.
