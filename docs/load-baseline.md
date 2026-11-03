# Ingestion load baseline

First measured baseline (spec §16, Stage 3f). These numbers are the backend budgets of addendum A2,
checked by `pnpm load` (`tools/load/src/budgets.mjs`, exit code 1 when one is broken).
Raw results: `tools/load/results/2026-10-18T1443Z-sustained-burst-abusive.json`. Tool choice: ADR 0031.

## How to run
```bash
pnpm build && pnpm db:migrate:test && pnpm load            # all scenarios, ~2 min
pnpm load sustained                                         # one scenario
```
The runner seeds a fresh org/project/browser key on the **local test DB** (it refuses any other
host), starts the built API on 127.0.0.1:5390 and drives it with autocannon. Batches look like
`@didban/analytics` output: `text/plain` body with the write key, SDK context, UUIDv7 IDs, page
views + one custom event in four, 5000 visitors (IP via one trusted proxy hop, 4 browser UAs).
`LOAD_CPU_PROFILE=<file>` also writes a V8 CPU profile of the API.

## Setup (recorded with every result)
| | |
|---|---|
| Machine | Intel i5-8400 (6 cores), 16 GB, Windows 10, Node 24.18.0. Client, API and DB on one box |
| PostgreSQL | 18.4, defaults: `shared_buffers` 128 MB, `work_mem` 4 MB, `synchronous_commit` on, fsync on |
| API | one process, `NODE_ENV=production`, `DB_POOL_MAX=10`, insert chunk 500, `TRUST_PROXY=1`, `INGEST_RATE_PER_KEY` lifted (one key carries all traffic), `INGEST_RATE_PER_IP` default 600/min |

## Results (2026-10-18)
| Scenario | Load | Accepted | p50 | p95 | p99 | Errors | API RSS / CPU |
|---|---|---|---|---|---|---|---|
| sustained (60 s) | 20 conn, 5-event batches | **3196 events/s** (640 batches/s) | 29 ms | 48 ms | 62 ms | 0 % | 303 MB / 106 % |
| burst (20 s) | 200 conn, 20-event batches | **9065 events/s** (455 batches/s) | 418 ms | 529 ms | 579 ms | 0 % | 361 MB / 103 % |
| abusive (20 s) | 50 conn: bad JSON / unknown key / one-IP flood | 4760 req/s rejected | 9 ms | 11 ms | 12 ms | 400/401/429 as designed | 369 MB / 90 % |

- Repeat runs of `sustained` the same day: 3057–3364 events/s, p95 46–52 ms, p99 62–87 ms.
- Abusive: exactly 600 batches accepted from the flooding IP (= `INGEST_RATE_PER_IP`), all others 429.
- DB: 0 rollbacks, 0 deadlocks, 0 statement timeouts, 0 connection errors. Rows = 200 responses ×
  batch size + the batches in flight when the client stopped (no row lost or duplicated).
- Burst latency is queueing: 200 connections over ~455 batches/s capacity ≈ 0.44 s (Little's law).

## Bottleneck (identified, not optimized)
1. **The API process is CPU-bound** (~100 % of one core, 10.8 % idle in the CPU profile). The
   largest share is the postgres.js driver (27.5 % building/serializing statements and parsing
   results, + ~9 % socket writes); our ingestion + event code is ~10 %, Fastify 2 %, Zod 2 %, Pino 3 %.
   Each batch runs about ten statements (BEGIN … COMMIT) in one transaction.
2. **Row locks on hot `pages_seen` rows** (popular pages are updated by every batch): up to 8–9
   of 10 connections wait on `pages_seen` upserts in nearly every sample. It amplifies (1): the
   lock is held while the busy event loop sends the next statements and the commit.

Candidates, only when a §20 trigger or a budget asks for them: fewer statements per batch,
skip a `pages_seen` update when `last_seen_at` is recent, more API processes (`INSTANCE_ROLE=ingest`).

## Budgets (this box; another machine needs its own baseline)
| Scenario | Throughput floor | p95 | p99 | Other |
|---|---|---|---|---|
| sustained | ≥ 2400 events/s | ≤ 80 ms | ≤ 150 ms | 0 errors |
| burst | ≥ 7000 events/s | ≤ 850 ms | ≤ 1000 ms | 0 errors |
| abusive | — | ≤ 20 ms | ≤ 25 ms | rejections only |
All scenarios: no timeouts, no connection errors, no deadlocks, API RSS ≤ 512 MB.
Not yet measured: runs on the Linux target.

## Stage 6c: full load + abuse run (2026-11-02, DoD 7)
Same box, PostgreSQL settings and API settings as above, plus `METRICS_TOKEN` (each result file
has the API's own `/metrics` after the scenario, cumulative since the API started) and the job
runner on (one deletion pass per minute, nothing to do). `pnpm load` now runs six scenarios.
Raw: `tools/load/results/2026-11-02T0924Z-sustained-burst-mixed-abusive-oversized-hostile.json`.

| Scenario | Load | Result | p50 | p95 | p99 | Statuses | RSS / CPU |
|---|---|---|---|---|---|---|---|
| sustained | as above | 1576 events/s | 52 ms | 105 ms | 294 ms | 18 948 × 200 | 309 MB / 89 % |
| burst | as above | 5843 events/s | 669 ms | 771 ms | 1084 ms | 5 869 × 200 | 362 MB / 97 % |
| mixed: ingest | 20 conn, 5-event batches | 1545 events/s | 53 ms | 114 ms | 314 ms | 18 570 × 200 | 362 MB / 85 % |
| mixed: stats | 3 conn, share view, 6 reports × 24 ranges | 107 req/s | 19 ms | 38 ms | 431 ms | 6 457 × 200, 0 × 429 | (same process) |
| abusive | as above | 3079 req/s rejected | 13 ms | 20 ms | 64 ms | 600 × 200, 400/401/429 | 367 MB / 88 % |
| oversized | 20 conn, 130 KiB bodies (limit 128 KiB) | 689 req/s | — | — | — | 13 921 × 413 | 392 MB / 83 % |
| hostile | 50 conn: bad Origin / Googlebot, new IP each / real batch | 774 req/s | 50 ms | 154 ms | 243 ms | 10 317 × 200, 5 183 × 403 | 389 MB / 91 % |

- **Abuse behaves as specified:** malformed JSON → 400 `INVALID_JSON`, unknown key → 401
  `INVALID_WRITE_KEY` (no DB work), one IP → exactly its 600 batches/min then 429
  (`didban_rate_limit_rejections_total{bucket="ingest_ip"}` = the 429 count), bad Origin → 403
  `ORIGIN_NOT_ALLOWED`, crawler UA → 200 with the events dropped (`didban_ingest_filtered_total
  {code="BOT_FILTERED"}` = 25 920, none stored: stored rows = the real batches only), > 128 KiB →
  413 `PAYLOAD_TOO_LARGE` read only up to the limit; Fastify closes each such socket, so autocannon
  counts a connection error per request and its latencies there are meaningless (Little's law:
  20 connections / 689 req/s ≈ 29 ms each). Quota, future/stale events and mid-batch DB failure
  are covered by API tests (`ingestion-limits`, `event-writer`, `ingest-unavailable`).
- **Stats under ingest load:** ingestion lost 2 % next to 107 stats req/s; stats p95 38 ms (most
  answers from the 15 s cache: 96 of the read-only transactions were real queries). The dataset is
  the run's own (~95 000 events), not 10 M: large-range plans are ADR 0037.
- 0 rollbacks, 0 deadlocks, 0 timeouts, 0 503s in every scenario. Pool: average wait for a
  connection 14.6 ms vs 30 ms per write transaction in `sustained`; lock waits on hot `pages_seen`
  rows in ~99 % of samples: the bottleneck named above, now visible in `/metrics`.

**Budgets are broken on this box today, and not by the code.** The same day, the commit that set
the budgets (9580a68, Stage 3f) ran `sustained` at 1990, 2135, 2134 events/s; this branch at 1608,
2368, 1710; develop (9accc47) at 1667. Windows reported 56 % CPU load before a run (other
sessions, editors, Defender). Run-to-run spread is ±20 %, larger than any difference between the
commits, so the metrics instrumentation costs nothing measurable. The budgets stay as they are
(set on a quiet box); re-measure on a quiet box or the Linux target before calling a regression.

**503 under CPU starvation (seen twice in the 6b rolling restart during a build).** Retryable
database failures (statement timeout 5 s, lock not available, deadlock, connection loss) answer
503 by design: the SDK retries and the event ID deduplicates. With 8 and 30 busy-loop processes on
6 cores, `sustained` ran at 805 and 1913 events/s, max 2.2 s, no 503 (Windows boosts I/O-bound
threads); the 6b case (WSL VM under host memory pressure) points to a transaction stalled past the
5 s timeout. Not changed: a longer timeout only holds `pages_seen` locks longer. New: the cause is
counted (`didban_ingest_unavailable_total{cause}`) and logged (`ingest 503: 57014 (...)`), tested
in `ingest-unavailable.test.ts`. Runbook: docs/operations.md "Ingestion failures".
