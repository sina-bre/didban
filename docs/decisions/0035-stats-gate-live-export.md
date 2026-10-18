# 0035 — Stats gate, realtime, data health and CSV export

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 4c (spec §3.1, §10, catalog 23.1/23.3): realtime, data health with an ingestion debugger,
CSV export of any breakdown, ≤ 3 concurrent stats queries per project (wait ≤ 2 s, then 429) and
a 15 s per-process response cache. No Redis or queues (spec §20).

## Decision
- `StatsGate` (one instance per process): a per-project counting semaphore with a 2 s queue
  timeout, and a 500-entry LRU keyed by project + route + parsed query (filters sorted). It is
  called after the permission guard, so a cached answer only reaches someone who may see the
  project. Realtime and exports pass no key (never cached); every route goes through the semaphore.
- Realtime and data health use fixed windows ending now (`live-context.ts`) on the same context
  loader as every stats query.
- The debugger is `RecentRejections` in a global `DiagnosticsModule`: ingestion writes batch-level
  rejections that have a known environment (code, origin ≤ 255 chars, time), data health reads.
  Analytics never imports ingestion. 20 per environment, ≤ 10 000 environments, per process.
- Export reuses each report's use case with the report's own schema and a 10 000-row limit;
  RFC 4180 CSV with BOM and CSV-injection guard; filename built from digits only.

## Consequences
With several API processes, cache and debugger are per process (documented in `docs/metrics.md`).
Unknown-key rejections (401) have no environment and never appear in the debugger. Revisit with a
shared store only when a §20 trigger (multiple stats replicas) is measured.
