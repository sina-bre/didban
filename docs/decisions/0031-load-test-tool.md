# 0031 — Load tests with autocannon against the real API

- Status: Accepted
- Date: 2026-10-18

## Context
Spec §16 asks for `tools/load` scripts (sustained, burst, mixed, abusive) and says to set backend
budgets from the first measured baseline (addendum A2). Options: k6 (Go binary, JS scripts),
autocannon (npm, by the Fastify maintainers), or a hand-written `node:http` driver.

## Decision
`tools/load` is a private workspace package with **autocannon 8.0.0** and **postgres.js 3.4.9**
pinned as dev dependencies (MIT, never shipped, no binary download, runs the same on Windows and
Linux). The runner seeds its own org/project/key with plain SQL on the **local test DB only**
(refuses other hosts), starts the built API as a child process and drives it with SDK-shaped
batches built per request. Every response time is kept, so p50/p95/p99 are exact (autocannon's
histogram has no p95). A `--import` probe reports API RSS/CPU over IPC (optional V8 CPU profile);
the API code is unchanged. Budgets live in `tools/load/src/budgets.mjs`; a broken one exits 1.

## Consequences
Closed loop (N connections, one request each): latency under overload shows as queueing, not
coordinated-omission-corrected open-loop latency; good enough for a baseline and regressions.
Client, API and DB share one box, so numbers are relative to that box (`docs/load-baseline.md`).
Revisit with k6 or a separate load machine for the Stage 6 full load tests, or if the client
itself becomes the bottleneck (autocannon > 1 core).
