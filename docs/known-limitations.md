# Known limitations

State at Stage 6d (2026-11-02). Each line says what is missing or unproven and where it is tracked.

## Not built (spec asks for it)
- **No TOTP / two-factor.** Addendum A9 moved it out of Stage 2 "before the first public
  release"; it is still missing, so DoD 3 ("enable TOTP") is unmet. No `ENCRYPTION_KEY` either.
- **No OpenAPI document.** Spec §2 wants it generated from the Zod schemas; [api.md](api.md) is
  hand-written from the controllers and `packages/contracts`.
- **No CI pipeline.** Only `.github/workflows/release.yml` exists (ADR 0052). Lint, tests, E2E,
  `pnpm audit` (spec §12: fail on high/critical) and a secret scan (A7) run locally only.
- **Nothing published to npm.** The release workflow is dry-run only; npm trusted publishing
  through `pnpm publish` is untested until the owner sets up the org and the environment
  ([releasing](releasing.md)).

## Measured, but not where it counts
- **Throughput budgets are unmet on today's dev box** (sustained 1576 events/s vs ≥ 2400; burst
  5843 vs ≥ 7000) while the box ran at ~56 % CPU from other work; the commit that set the budgets
  misses them the same day, so it is not a code regression ([load baseline](load-baseline.md)).
  **No load test has run on the Linux target** or on a quiet machine since 2026-10-18.
- Linux deployment was validated on Ubuntu 24.04 in **WSL2** on the dev box, not a separate VM or
  server. TLS was Caddy's internal CA, not ACME.
- **Windows services were never installed** (WinSW for the API and Caddy, Task Scheduler backup):
  that needs an administrator. Deploy, backup and restore-check ran without services.
- **Large stats ranges are slow at 10 M events in one project** (PostgreSQL defaults, dev box):
  30-day overview 3.3 s, 90-day top pages and event-property keys exceed the 10 s timeout. The
  dashboard defaults to 30 days; spec §20's rollup trigger (overview p95 > 500 ms on 30 days) is
  met at that volume ([database](database.md)). Not re-measured with production PostgreSQL tuning.
- Lighthouse LCP behind Caddy h2 was measured without the COOP header (Lighthouse 13.6 + Chrome
  156 fail with it: NO_NAVSTART).

## By design (documented trade-offs)
- **Cookieless mode overcounts returning visitors across days**: the visitor ID changes at
  00:00 UTC, so a multi-day count is a sum of daily uniques, and visits split at midnight UTC
  ([metrics](metrics.md#visitors)). Persistent mode avoids it where consent allows.
- **Rate limits, login limits, the key cache and the 15 s stats cache are per process.** The
  documented production layout runs two instances, so effective limits are up to 2× the setting.
  Spec §20's trigger ("more than 1 API replica" → shared limiter) is therefore met; see next steps.
- **Pool metrics cover transactions only**: postgres.js hides its pool, so `didban_db_pool_*`
  measures calls through `sql.begin` (all ingest, stats and job work); a bare query outside a
  transaction is not counted (ADR 0049).
- SDK delivery is at-least-once, best effort: the in-memory queue is lost if the final beacon
  fails; no offline queue ([SDK](sdk.md#delivery-semantics)).
- Deduplication by `(project_id, event_id)` lasts only as long as the event row (retention).
- Retention is unset (keep forever) until a project sets it; backups keep deleted rows ≤ 14 days.
- One PostgreSQL server, nightly `pg_dump` (RPO 24 h), no replication or PITR (spec §20).
- No e-mail: password resets go through owners or `pnpm cli reset-password`.
- `prom-client` 15 is marked deprecated upstream (successor `@prometheus-io/client` is pre-1.0).

## Test gaps
- Timing-sensitive tests (dashboard `findBy`, some API timeouts, E2E login) flake when the box is
  under load; they pass on rerun. Recorded per stage in `docs/plan/progress.md`.
- Untested areas are listed in the Definition-of-Done report (`docs/plan/definition-of-done.md`).
