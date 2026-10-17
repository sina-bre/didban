## 20. Scale triggers (do nothing here until the measured condition is true)

| Condition (measured, sustained, recorded) | Action |
|---|---|
| More than 1 API replica | Replace in-memory rate limiter and per-process caches' correctness-critical parts with Redis-backed limiter. Keep fail-open vs. fail-closed behavior explicit per bucket. |
| `events` > 50 M rows, or nightly retention delete > 30 min, or the `occurred_at` index exceeds ~25% of RAM | Monthly partitioning + `event_ids` dedupe table (section 9.4). |
| Overview p95 > 500 ms on a 30-day range at current volume after plan inspection | Daily count rollups (not uniques). |
| Property-filter query p95 > 1 s | Expression index on the specific hot property keys, per project; no blanket GIN. |
| Ingestion p99 > 250 ms or DB CPU > 70% sustained at expected peak with batching tuned | Increase batch size/chunking first; then outbox/queue with explicit ack, retry, dead-letter, idempotency. |
| `replicas × pool` exceeds connection budget | PgBouncer in transaction mode (verify Prisma compatibility settings for the installed version). |
| Stats p95 > 2 s after rollups, or > 500 M events | Evaluate a columnar store as a read replica of events. This is a new ADR, not an automatic change. |
| Required RPO < 24 h | WAL archiving / PITR. |
| > 5 human users or any self-service reset demand | Add SMTP-based invites and resets. |
| Dashboard and API must live on different sites | Switch CSRF to double-submit tokens; revisit cookie `SameSite`. |
| Dashboard p95 latency degrades during ingestion bursts, confirmed by metrics | Run a second instance with `INSTANCE_ROLE=ingest` on its own port/hostname and keep management on the first (section 14.0). |
| Any cross-tenant leakage defect, or more than 2 developers writing data-access code | Add PostgreSQL row-level security as defense in depth (per-request `SET LOCAL` of the scope). New ADR; verify Prisma transaction handling first. |
| `/__other__` overflow appears in `pages_seen` for a project | Operator adds route templates. No code change. If it recurs after templates, raise the cap with a measured storage estimate. |
