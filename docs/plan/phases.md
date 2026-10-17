# Phases

Each **sub-stage fits one session**. A session ends with: checks run (real output pasted), `progress.md`
updated, commit. Do not start a stage while the previous gate is red. Spec: `docs/spec/18`, `19`.

## Phase 0 — Agent setup and specs ✅ (2026-10-17)
Skills installed, MCP config, CLAUDE.md files, spec split by section, addendum, ADRs 0000–0014, design system.

## Stage 1 — Foundation ✅ (2026-10-17)
- 1a Workspace: pnpm workspaces, `.nvmrc` (24), `engines`, TS 6 strict base config, Biome, `check-file-size.mjs`,
  logical-properties lint check, repo hygiene files (LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT).
- 1b `packages/contracts`: limits, error codes, event envelope schema (Zod 4), inferred types, tests.
- 1c `apps/api` skeleton: NestJS 12, Zod env config (fail fast), Pino with redaction, health live/ready,
  Vitest + SWC verified with one decorator test.
- 1d postgres.js + SQL migration runner (ADR 0016) + `scripts/dev-db.mjs` (dev/test DBs, `analytics_migrator`/`analytics_app` roles), first migration,
  migration workflow documented. Add a Biome format hook in `.claude/settings.json`.
- **Gate:** clean DB migrates; `pnpm typecheck lint test` green; API starts and `/health/ready` answers 200.
- Skills: `supabase-postgres-best-practices`, `nestjs-best-practices`, `vitest`.

## Stage 2 — Backend core + auth
- 2a Users, Argon2id, sessions, cookie, CSRF origin check, login rate limits, CLI `create-owner`.
- 2b Organizations, memberships, project members, platform-admin flag + CLI, last-owner rule.
- 2c `AccessScope` guard, permission decorator, route-coverage test, 404 existence hiding.
- 2d Projects, environments, API keys, audit log, owner-created users + temporary-password reset (A9).
  TOTP + recovery codes: optional, before the first public release (A9).
- **Gate:** two-org isolation tests (404 everywhere), route-coverage, login/session/CSRF tests green.

## Stage 3 — Ingestion + SDK
- 3a Ingestion pipeline steps 1–5 (body limit, key auth + LRU, origin check, diagnostics, rate limit, validate).
- 3b Enrichment (IP/trusted proxy, UA parser per ADR 0001, geo, bots, PII, URL, referrer/channel, route templates).
- 3c Identity, visit resolution, bulk writer, `pages_seen`, server-key events, dedupe/retry tests.
- 3d SDK core (queue, transport, retry, consent, SPA, lifecycle) + size-limit.
- 3e SDK modules, React adapter, `examples/vanilla-vite`, `examples/nextjs-app-router`, `examples/script-tag`,
  proxy docs, `docs/integration.md`, host-site performance trace (no long tasks > 5 ms).
- 3f First load-test baseline (`tools/load`).
- **Gate:** spec §18 Stage 3 gate + publint/attw/tarball install pass.

## Stage 4 — Analytics
- 4a Query builder (filters allowlist, range/interval, tz bucketing), overview + timeseries + comparison.
- 4b Pages (top/entry/exit/discovered/detail), sources, geo, devices, events, properties.
- 4c Goals + revenue, realtime, data health, CSV export, share links, semaphore + 15 s cache.
- 4d 10 M-event seed script, `EXPLAIN (ANALYZE, BUFFERS)` per query recorded in `docs/database.md`.
- **Gate:** boundary tests (DST, midnight UTC, range edges) green; plans recorded; no query over timeout.

## Stage 5 — Dashboard (unblocked: design from screenshots, ADR 0003)
- 5a Vite + Tailwind 4 + tokens, fonts, i18n (`t()`, `en`/`fa`), direction switch, app shells (desktop/mobile).
- 5b `shared/ui` primitives + gap-list widgets (ADR 0004), `shared/components` wrappers.
- 5c Auth pages, org/project switcher, overview, realtime.
- 5d Pages, sources, geo, devices, events, goals, data health, filters in URL, export.
- 5e Settings, onboarding wizard + live check, members, sharing, audit, admin pages, `/share/:token`.
- 5f Playwright E2E flow, Lighthouse mobile, RTL visual pass (`fa`), a11y audit.
- **Gate:** every number traces to persisted events; E2E green; budgets in addendum A2 met.

## Stage 6 — Hardening and release
- Retention/deletion jobs, backup + restore-check executed, systemd/Caddy validated on a clean Ubuntu VM,
  full load + abuse tests, `pnpm audit`, docs complete, Changesets + release workflow (dry run only).
- **Gate:** Definition of Done (`docs/spec/19`).
