# Progress log

Newest first. ≤ 10 lines per entry: what was done, checks run + result, what is next, open questions.

## 2026-10-17 — Stage 2c (AccessScope guard, permissions, routes)
- `domain/permissions.ts` (pure `decide()` → allow/404/403), `modules/access/*`: scope loader (skips suspended
  orgs, archived projects), `@Requires(permission)`, `authorize()` called by the one global guard (fails closed). ADR 0019.
- Routes: `GET /organizations`, `GET /projects`, `PATCH|DELETE /organizations/:id/members/:userId`,
  `PUT|DELETE /projects/:id/members/:userId`, `POST /admin/organizations`, `PATCH /admin/organizations/:id`.
  `UuidPipe` (bad ID → 404). Contracts: `organizations.ts`. DELETE also sends a JSON body (CSRF rule).
- Tests: route coverage (public = allowlist), two-org isolation (B and non-member platform admin get identical
  404 on every A route), viewer/admin 403, suspended org hidden. Mutation check: removing one `@Requires` fails 4 tests.
- Checks: lint, typecheck, build ok; tests 19 + 79 passed; live server: ready 200, new routes 401 without cookie,
  foreign Origin 403. Killed a stale API process from the last session that was holding port 3000.
- **Next:** 2d projects (settings columns), environments, API keys, audit log, invites, TOTP, reset links.

## 2026-10-17 — Stage 2b (organizations, memberships, project members)
- `migrations/0003_projects_and_members.sql`: `projects` (identity columns only; settings in 2d), `project_members`
  with composite FKs through `organization_id` + index (EXPLAIN in ADR 0018).
- `src/domain/org-roles.ts` (pure rules); use cases: change role, remove member (last-owner rule, org row lock),
  assign/remove project member, platform-admin create/suspend org; `pnpm cli grant|revoke-platform-admin <email>`.
- Org role / platform-admin change revokes the target's sessions (rotation, ADR 0018). `insertOrganization` shared with create-owner.
- No HTTP routes yet: they land in 2c with the permission decorator + route-coverage test.
- Checks: typecheck, lint, build ok; tests 19 + 61 passed (concurrent mutual-demotion test → 1 owner);
  dev DB migrated (rerun "up to date"); server started, `/api/v1/health/ready` 200; CLI exits 1 on bad input.
- **Next:** 2c `AccessScope` guard (skip suspended orgs), permission decorator, routes for 2b use cases, route-coverage test, 404 hiding.

## 2026-10-17 — Stage 2a (auth core)
- `migrations/0002_auth_sessions.sql`; `src/modules/auth/*` (login, logout, logout-all, me, change password),
  global `SessionGuard` + `@Public()`, CSRF `onRequest` hook, `ZodPipe`, `SESSION_COOKIE` env switch.
- `@node-rs/argon2` 2.2.2 (m=19456,t=2,p=1; verify 33 ms), SecLists 10k list in `apps/api/data/`, in-memory
  login limiter, `pnpm cli create-owner` (prompts; piped input works). ADR 0017. Contracts: `auth.ts`.
- Checks: build, typecheck, lint ok; tests 19 + 43 passed; live server on test DB: login 200 + cookie,
  me 200, foreign Origin 403, logout 204 → me 401, CLI create/duplicate exit 0/1.
- CLI prompt fixed after owner run: readline muting dropped input on Windows; now raw-mode keys,
  bracketed-paste markers stripped. Owner set `.env`, migrated dev DB, created the first owner.
- Not built here (later sub-stages): audit log rows (2d), rotation on privilege change (2b), session purge (6).
- **Next:** 2b organizations, memberships, project members, platform-admin flag + CLI, last-owner rule.

## 2026-10-17 — Stage 1d done → **Stage 1 gate met**
- Decision: no ORM. postgres.js 3.4.9 + forward-only SQL migrations (checksum + advisory lock), ADR 0016, addendum A8.
- `pnpm db:setup` is now Node (`scripts/dev-db.mjs`; bash failed on Windows: pnpm picked WSL's bash).
  Owner ran it: roles analytics_migrator/analytics_app, DBs didban_dev/test/shadow, URLs in `.env`.
- `migrations/0001_identity.sql` (organizations, users, memberships); `/health/ready` checks DB (2 s).
- Checks run: `pnpm db:migrate` applied 0001, second run "up to date"; `pnpm test` 17 + 13 passed (real
  test DB: app role DDL → 42501, timeouts 15s, idempotent migrate, edited migration refused, DB down → 503);
  live server `/health/ready` 200 with DB; build, typecheck, lint ok.
- Open: owner should rotate the local postgres superuser password (it was pasted in chat).
- **Next:** Stage 2a (users, Argon2id, sessions, cookie, CSRF, login limits, `create-owner` CLI).
  Needs: a common-password list for the password policy (spec §11) — download approval pending.

## 2026-10-17 — Stage 1c (API skeleton)
- Renamed product to **didban** (`@didban/analytics`, `@didban/react`, private `@didban/contracts`, `@didban/api`).
- `apps/api`: NestJS 12.1.3 (ESM-only) on Fastify 5.12.5, SWC 1.16 build, Zod env (fail fast, prod https rule,
  TRUST_PROXY hops/CIDRs, INSTANCE_ROLE), Pino redaction (no IP, no query strings), request id header,
  one error body, health live/ready with shutdown flag. ADR 0015. `.env.example`.
- Bug found by live run + fixed: 404 body echoed the URL (incl. `?token=`) → fixed messages per status + test.
- Biome rules off for apps/api: `useImportType` (breaks Nest DI), `noStaticOnlyClass` (Nest dynamic modules).
- Checks: build ok, typecheck ok, tests 17 + 7 passed, lint ok; live server: ready 200, 404 clean, 140 KB → 413.
- Not yet verified: graceful shutdown on SIGTERM (Windows has no real signals → verify on Linux in Stage 6).
- **Next:** 1d Prisma 7 + `scripts/dev-db.mjs` + first migration + DB in `/health/ready`.

## 2026-10-17 — Stage 1a + 1b
- Spec `23-feature-catalog.md` added (owner asked for more features + boundaries; v1+ items are cheap, no new infra).
- 1a: pnpm workspace, `.nvmrc` 24, TS 6.0.3 base config, Biome 2.5.15 (40-line functions, complexity 12),
  `check-file-size.mjs`, `check-logical-css.mjs`, Biome format hook for Claude edits, LICENSE (MIT), CONTRIBUTING,
  SECURITY, CODE_OF_CONDUCT, .editorconfig, .gitattributes (LF).
- 1b: `packages/contracts` (zod 4.6.7): limits, error codes, properties, events, envelope, response. 17 tests.
- Checks run, all green: `pnpm build`, `pnpm typecheck`, `pnpm test` (17 passed), `pnpm lint`.
- Gotcha: TS base lib has no DOM; packages that run in browsers add `"lib": ["ES2023","DOM"]`.
- **Next:** 1c `apps/api` skeleton (NestJS 12, env config, Pino, health, Vitest + SWC).
- Product name: **didban**, npm scope `@didban` (owner, 2026-10-17).

## 2026-10-17 — Phase 0 (agent setup)
- Git initialized (repo was empty except 7 design screenshots → moved to `design/reference/`).
- Installed 15 project skills (`skills-lock.json`), wrote `.mcp.json` (context7, playwright, postgres read-only).
- Spec split into `docs/spec/00–21` + `22-addendum.md`; phases, ADRs 0000–0014, design system written.
- Verified on this box: Node 24.18.0, pnpm 11.21.0, PostgreSQL 18.4, git 2.51. Disk was full (1 MB) →
  npm cache cleared, 9.3 GB free. Stage 1 needs ~2 GB.
- No code yet; no checks to run.
- **Next:** Stage 1a.
- Owner decisions: MIT license; screenshots OK as reference; React Aria approved (date picker + combobox only).
- **Open (owner):** product name / npm scope (needed only before first publish).
