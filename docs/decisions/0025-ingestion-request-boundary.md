# 0025 — Ingestion request boundary (Stage 3a)

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §7 steps 1–5 and §6: body limit, write-key auth with an LRU, origin check with diagnostics,
rate limit and quota, then validation. The spec leaves open the rate numbers, how quotas are set,
where counters live, and what a valid batch returns before the event writer exists (Stage 3c).

## Decision
- **Order:** body limit (Fastify `bodyLimit`, on the stream) → JSON → write key → Origin
  (browser keys) → rate limit → quota → envelope → events (skew-corrected, partial success).
  Both `text/plain` and `application/json` are accepted. For `application/json`, Fastify's own
  secure parser is wrapped so that a parse failure returns `INVALID_JSON`.
- **Write keys:** the token's shape is checked before any lookup, and the cache is keyed by its
  SHA-256. A per-process LRU (10 000 entries) keeps known keys 60 s and unknown keys 10 s.
  **Revocation and environment changes (allowed origins) take effect within 60 s per process.**
  Keys of archived projects or suspended organizations resolve like unknown keys
  (`INVALID_WRITE_KEY`). `last_used_at` is kept in memory and flushed once a minute.
- **Origin:** exact match of the normalized `Origin` against `environments.allowed_origins`. A
  missing Origin or an empty allowlist rejects. This is a spam filter: outside a browser anyone
  can send any Origin. Server keys skip it. CORS answers `*` (no credentials are involved) and
  is set in `onRequest`, so error responses carry it too.
- **Rate limits:** in-memory fixed one-minute windows per process. Defaults: 6000 requests per
  key (`INGEST_RATE_PER_KEY`) and 600 per IP (`INGEST_RATE_PER_IP`). The IP bucket applies to
  browser keys only, because server keys send from one operator IP. 429 includes `Retry-After`.
- **Quota:** `organizations.daily_event_quota` (NULL = unlimited) is compared with the sum of
  `project_usage_daily` for the organization's projects on the current UTC day. That is one
  indexed read per batch. `QUOTA_EXCEEDED` sets `Retry-After` to the next UTC midnight. Usage
  rows are written with the events (step 8, Stage 3c).
- **Diagnostics:** rejections whose environment is known are counted in memory by
  (environment, hour, code), including per-event codes. Rejected origins are truncated to 255
  chars, with at most 20 distinct per environment and UTC day. Both are flushed once a minute
  and on shutdown, with bulk upserts. Two processes flushing together may overshoot the origin
  cap slightly.
- **Until Stage 3c:** a batch that passes every check gets `503 SERVICE_UNAVAILABLE`. A `200`
  means "committed to PostgreSQL" (§6.4), and nothing is stored yet. (Ended in 3c: ADR 0028.)

## Consequences
- An ingest request costs one key lookup per minute per key and one quota read. No writes yet.
- Limits and caches are per process; with more than one replica the effective limits multiply.
  The §20 trigger (more than one API replica) moves the limiter to Redis.
- Visitor-count and property-key limits (§6.2) need identity and storage: they arrive in 3c
  (visitor count done in ADR 0028; property keys still open).
