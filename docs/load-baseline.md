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
Not yet measured: mixed ingestion + stats (needs the Stage 4 stats API), runs on the Linux target.
