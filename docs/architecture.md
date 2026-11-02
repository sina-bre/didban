# Architecture

```
browser ── @didban/analytics (+ @didban/react) ──┐  text/plain JSON, write key in body
server  ── fetch with a write_server key ─────────┤
                                                  ▼
            Caddy (TLS, h2, headers, /api/* → API, SPA from disk)
                                                  ▼
   API instances (NestJS 12 on Fastify, 127.0.0.1:5101/5102, INSTANCE_ROLE all|ingest|management)
     ingestion ─► events (writer) ──┐        analytics (read-only) ◄── dashboard (React SPA)
     auth, tenancy, settings, jobs ─┤                │
                                    ▼                ▼
                  PostgreSQL 16+ (roles: analytics_migrator DDL, analytics_app DML)
```
One box, no containers, no queue, no cache server (spec §5, ADR 0047/0048). `200` from ingestion
means the batch is committed (one transaction per request, multi-row inserts). Nothing is
buffered in memory for later.

## Repository
```
apps/api/            NestJS API: src/modules/<feature>/ (one use case per file), src/domain/ (pure
                     rules), src/db/ (postgres.js, migrations runner), migrations/NNNN_*.sql, cli/
apps/dashboard/      React 19 + Vite 8 + React Router 8 + TanStack Query, Tailwind 4, en + fa (RTL)
packages/contracts/  Zod 4 schemas, limits and error codes shared by API, SDK and dashboard (private)
packages/sdk/        @didban/analytics: core + optional modules + script-tag IIFE build (public)
packages/react/      @didban/react: AnalyticsProvider, useAnalytics (public)
examples/            vanilla-vite, nextjs-app-router, script-tag: real SDK installs used by E2E
e2e/                 Playwright suites (SDK examples, server events, dashboard, trace, a11y, perf)
tools/load/          autocannon load + abuse scenarios, budgets, seeders (ADR 0031)
deploy/              systemd units, WinSW XMLs, Caddyfile, Nginx sample
scripts/             db:setup, deploy, backup, restore-check, lint guards, package + release checks
docs/                this documentation, spec/, plan/, decisions/ (ADRs), design-system/
```

## Request paths
- **Ingest** (`POST /api/v1/ingest/batch`, ADR 0025–0028): body limit on the stream → JSON →
  envelope schema → write key (in-memory key cache) → origin allowlist → rate limits and quota →
  per-event validation and enrichment (UA, geo, channel, route template, PII guard, bot and
  internal-traffic filters) → visitor hash (daily salt) → one transaction: visits, events
  (`ON CONFLICT (project_id, event_id) DO NOTHING`), `pages_seen` → response.
  Rejections feed `ingestion_diagnostics` (Data Health).
- **Stats** (ADR 0033–0037): session guard → access scope → per-project gate (concurrency,
  15 s cache) → SQL on `events`/`visits` with project time zone, filters, comparison.
- **Management:** session guard → permission decorator → use case (row locks where roles change)
  → audit log.
- **Jobs** (ADR 0045): on management instances, an advisory lock elects one runner; it processes
  data-deletion requests, then nightly retention, in 10 000-row chunks recorded in `job_runs`.

## Instances
`INSTANCE_ROLE=ingest` mounts health, metrics and ingestion; `management` health, metrics, everything else and the job runner; `all` both
(default). Production runs two `all` instances behind Caddy for rolling restarts; `SIGTERM` drains
for `SHUTDOWN_DRAIN_MS` with `/ready` = 503 before closing (ADR 0047).

Further reading: [database](database.md) (schema, plans), [api](api.md), [security](security.md),
[load baseline](load-baseline.md), [deployment](deployment.md).
