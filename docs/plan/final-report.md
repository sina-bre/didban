# Final report (spec §19 "Final report must contain")

State: Stage 6d, 2026-11-02, branch `claude/practical-babbage-620d3e` (6a–6d unmerged; develop at
9accc47 has 6a + 6b). Item-by-item check: [definition-of-done.md](definition-of-done.md).

## What was implemented
Self-hosted analytics: browser SDK `@didban/analytics` (core 4.99 kB gz, 4 optional modules, script
tag) and `@didban/react`; NestJS 12 / Fastify ingestion with origin, rate, quota, PII and bot
checks, server-derived visitors (cookieless daily salt or persistent) and visits; analytics API
(overview, time series, pages, sources, geo, devices, events + properties, goals with revenue,
realtime, data health, CSV export, share links); React dashboard in en + fa (RTL), mobile first;
accounts without signup (owner-created users, temporary passwords), organizations, project roles,
audit log, platform admin; retention and data-deletion jobs; `/metrics`; deploy, backup and
restore scripts for Linux and Windows; Changesets release workflow (dry run). Stage history:
[progress.md](progress.md).

## Resulting tree
See [architecture.md](../architecture.md#repository). 2 apps, 3 packages (2 public), 3 examples,
E2E, load tool, `deploy/`, `scripts/`, 15 forward-only migrations, 52 ADRs.

## Decisions and reasons
[`docs/decisions/`](../decisions/): 0001 stack/versions, 0007 cookieless default, 0008
server-derived visits, 0009 session auth same-origin, 0012 no partitioning at launch, 0013 flat
properties, 0014 no RLS in v1, 0016 SQL without ORM, 0019 access-scope guard, 0025–0028 ingestion,
0033–0037 stats, 0045 jobs, 0047/0048 deployment, 0049 metrics, 0050 autovacuum, 0051 audit
overrides, 0052 releases. Each records the trigger that would revisit it.

## Schema and indexes with `EXPLAIN` evidence
Migrations `apps/api/migrations/0001–0015`. Hot indexes: `events_range_idx (project_id,
environment_id, occurred_at DESC)`, `events_name_idx (project_id, name, occurred_at DESC) WHERE
type = 2`, `visits_visitor_idx`, `visits_started_idx`; primary key `(project_id, event_id)` is the
dedupe. Plans: [database.md](../database.md) and `tools/load/results/plans-2026-10-18.md` (every stats
statement on 10 M events), `job-plans-2026-11-01.md` (retention/deletion chunks), ADR 0050
(autovacuum: post-delete probe 280 s → 0.2 ms, `vacuum-check-2026-11-02.log`).

## Security and authorization boundaries
[security.md](../security.md) (trust model, controls, what is not claimed) and
[tenancy.md](../tenancy.md) (roles, guard, 404 isolation, evidence). Boundaries: session cookie +
same-origin CSRF for management; write keys (write-only, origin allowlist as spam filter) for
ingestion; share tokens (read-only, one project); bearer token for `/metrics`; DML-only DB role.

## Every command run, with its result
[dod-evidence.md](dod-evidence.md): lint, typecheck, build, test, E2E, `pnpm audit`,
`pnpm check:packages`, `pnpm release:dry-run`, `pnpm dev` smoke, with real output and reruns.
Deployment commands and results: [deployment.md](../deployment.md#validation-record). Load runs:
[load-baseline.md](../load-baseline.md).

## Test coverage and untested areas
Suites: contracts, SDK (jsdom), React adapter, API integration on a real PostgreSQL test database
(isolation, access, ingestion limits, writer, stats, jobs, metrics), dashboard (jsdom + browser),
36 Playwright E2E tests (SDK examples, server events, dashboard flows, trace = SQL, fa RTL + axe
a11y, perf). No line-coverage tool is configured; instead each stage ran manual mutations and
recorded that each fails a test (progress.md). **Untested:** TOTP (not built); WinSW/Caddy
services and Task Scheduler on Windows; a clean-machine README run; load on Linux or a quiet box;
ACME TLS; npm trusted publishing; restore of a production-size backup (restore checked on dev
data only); multi-day cookieless counts in a browser over a real midnight (unit-tested only);
GeoIP with a real GeoLite2 file (unit tests map a fixture record; no `.mmdb` is read in any test); Safari and Firefox (E2E runs
Chromium only).

## Load-test methodology, hardware, results
`pnpm load` (autocannon, ADR 0031): seeds a fresh org/key on the local test DB, starts the built
API (`NODE_ENV=production`, one process, pool 10), drives six scenarios with SDK-shaped batches
from 5 000 visitors, scrapes `/metrics` after each. Hardware: i5-8400 (6 cores), 16 GB, Windows
10, PostgreSQL 18.4 defaults, client + API + DB on one box. Baseline 2026-10-18: sustained 3196
events/s (p95 48 ms), burst 9065 events/s. 6c run 2026-11-02 on a busy box: sustained 1576
events/s (p95 105 ms), burst 5843, abuse paths all as specified, 0 errors/deadlocks/timeouts;
budgets broken by box load, not code (A/B with the baseline commit). [load-baseline.md](../load-baseline.md).

## Known limitations
[known-limitations.md](../known-limitations.md).

## Next priorities
1. **Close the DoD gaps:** TOTP (A9, before the first public release); install and record the
   Windows services with an admin; a clean-machine README run; a CI workflow (lint, typecheck,
   tests, E2E, `pnpm audit --audit-level high`, secret scan); OpenAPI from the Zod schemas.
2. **§20 triggers already met by design or measurement:** two API instances in production → a
   shared rate limiter (Redis or PostgreSQL-backed), stated per bucket fail-open/closed; 30-day
   overview > 500 ms at 10 M events → daily count rollups. Re-measure load on the Linux target.
3. **§3.2 v1.1 in order:** funnels, read-only stats API keys, annotations, Web Vitals module,
   Node.js server SDK, e-mail digest (needs SMTP, which also unlocks §20 e-mail resets).
4. First npm release once the owner sets up `@didban` and the `npm` environment ([releasing](../releasing.md)).
