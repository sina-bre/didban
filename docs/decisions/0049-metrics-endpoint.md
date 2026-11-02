# 0049 — `/metrics`: root path, bearer token, prom-client, measured pool

- Status: Accepted
- Date: 2026-11-02

## Context
Spec §15 asks for `GET /metrics` (Prometheus text via `prom-client`), "bound to localhost or
protected by a bearer token, never public", with ingestion, DB, rate-limit, stats, job and process
metrics. Each box runs two API instances behind Caddy or Nginx on 127.0.0.1 (ADR 0047). A
loopback check alone is worthless there: every proxied request also comes from 127.0.0.1.
postgres.js keeps its pool queues private. `prom-client` 15.1.3 is marked deprecated in favour of
`@prometheus-io/client` (0.16, first published 2026-08).

## Decision
`/metrics` lives at the root, excluded from the `api/v1` prefix; both proxy configs forward only
`/api/*`, so it is never reachable through them. It also requires `Authorization: Bearer
$METRICS_TOKEN` (≥ 32 characters, compared as SHA-256 digests with `timingSafeEqual`); with no
token set it answers 404, so metrics are off unless an operator opts in. Prometheus scrapes each
instance on `127.0.0.1:510x` with `bearer_token_file`. One `Registry` per app instance (no global
registry; tests build many apps). Labels only take values from fixed sets (statuses, contract
codes, route templates, job names). The pool is measured where we use it: `sql.begin` is wrapped
(`db/instrument-pool.ts`) to count transactions waiting for / holding a connection and to time
wait and BEGIN→COMMIT. Job gauges are read from `job_runs` at scrape time, so every instance
reports the cluster's state. We stay on `prom-client` (named by the spec, stable for years).

## Consequences
- No public exposure even with a mis-set proxy: the token still guards the route.
- Pool numbers cover transactions (ingest writes, stats reads, jobs), not single statements outside
  a transaction (session lookups); those are short and visible in `pg_stat_activity`.
- Stats latency is per request (cache hits included), the number a dashboard user feels.
- Revisit: `@prometheus-io/client` reaches 1.0, or postgres.js exposes pool state.
