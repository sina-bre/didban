## 18. Stages and gates

> Expanded with checklists in `docs/plan/phases.md`.

**Stage 1: Foundation.** Workspace, TS strict configs, lint/format, Zod env validation, contracts package, Prisma setup, migration workflow, `scripts/dev-db.sh`.
*Gate: clean DB migrates; `typecheck`, `lint`, `test` run green (even if few tests).*

**Stage 2: Backend core + auth.** Users, sessions, Argon2id, TOTP, invites, CLI, organizations (multi-tenant), memberships, project members, platform-admin flag and CLI, projects/environments/keys, audit, access-scope guard + route-coverage test, health, logging, rate limiter.
*Gate: two-organization isolation tests green on every route (404 for inaccessible resources); route-coverage test green; login/session/CSRF tests green.*

**Stage 3: Ingestion + SDK.** Event contract, pipeline, enrichment, route templates, `pages_seen`, diagnostics, visit resolution, bulk writer, server-key events, SDK core + modules, React adapter, size budget, vanilla and Next.js App Router examples, ad-blocker proxy docs, `docs/integration.md`.
*Gate: both example apps' events land in PostgreSQL (page views exactly once per navigation in Next.js); a server-event `curl` with `$revenue`/`$currency` lands; real client IP reaches the collector through the Next.js proxy example; SDK tests green; duplicate retry test green; first load-test baseline recorded.*

**Stage 4: Analytics.** Metric implementations exactly per section 4, all stats endpoints, discovered pages and page detail, data health, goals with revenue, export, share links, query limits.
*Gate: aggregation boundary tests green; `EXPLAIN` plans recorded; no stats query above its timeout on the 10 M-event dataset, or the slow ones are documented with a measured plan.*

**Stage 5: Dashboard.** **Blocked until `./ui-template/` exists.** Template inspection and gap list, vendoring, all routes, all states, onboarding wizard, organization/project switcher, platform-admin pages.
*Gate: every number on screen traces to a persisted event; E2E flow green.*

**Stage 6: Hardening and release.** Retention/deletion jobs, backup/restore check, systemd/Caddy files validated on a clean VM or equivalent, full load tests, abuse tests, docs complete, dependency audit.
*Gate: Definition of Done below.*
