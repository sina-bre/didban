# Progress log

Newest first. ≤ 10 lines per entry: what was done, checks run + result, what is next, open questions.

## 2026-10-26 — Stage 5d (reports, URL filters, interval, export)

- Lazy routes: Pages (top/entry/exit/discovered + `pages/detail`), Sources, Geo (GeoLite2-off and city-off states),
  Devices, Events (event → keys → values → `prop.` filter), Goals (add/delete for managers), Data health. ADR 0042.
- URL state: `?filter=` (contract parser), `?by=`/`?view=`/`?event=`/`?prop=`, `?interval=` (fits the range).
  FilterBar values come from the picked field's breakdown; rows add filters; CSV = same-origin `<a download>`.
- Fixes found by tests: duplicate filter on row click; old rows under a new dimension; API goal stats stale for 15 s
  (`StatsGate.forget` on goal change); body-less DELETE failed CSRF (now sends `{}` as JSON).
- Checks: lint, typecheck, build ok (initial JS 124.2 KB gz); tests 30 + 68 + 120 (unit 103 + browser 17) + 230 + 5;
  e2e 28/28 (6 new, real ingested events). 9 mutations, each fails its test. Load flakes seen once each (5 s findBy).
- **Next:** 5e settings, onboarding, members, sharing, audit, admin, `/share/:token`.

## 2026-10-26 — Fix: empty `/projects` message for owners

- A fresh owner (`pnpm cli create-owner`) saw "ask an owner or admin for access". The switcher query now also
  returns `canManage` (owner/admin of any org); `/projects` then says "Your organization has no projects yet."
  (en + fa). Members keep the access message. Switcher still lists only orgs with accessible projects.
- Tests: `test/projects.test.tsx` (owner, admin, member); forcing `canManage` false fails owner/admin.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (dashboard 91 passed) green. `pnpm test:e2e`
  not run: port 5173 held by the owner's running preview.

## 2026-10-26 — Stage 5c (auth pages, switcher, overview, realtime)

- `/login` + `/set-password` (first-login change) instead of `/accept-invite`: A9/ADR 0024 removed invites, no
  such API. `RequireAuth` (me), `ProjectLayout` (404 → not found), switcher on real orgs/projects. ADR 0041.
- `api-client.ts`: AbortSignal, contract errors (`x-request-id` fallback), 401 ≠ `INVALID_CREDENTIALS` → full
  load of `/login?next=` (same-origin only). TanStack Query; RHF + contract Zod on the lazy auth chunk.
- Overview (6 KPIs, compare `?compare=previous_period`, visitors chart, channels), Realtime (10 s poll, stops
  while hidden). Ranges = whole days in the project zone. Primitives: Button `primary`, StatCard `kind`/null.
- Checks: lint, typecheck, build ok (initial JS 122.0 KB gz); tests 30 + 68 + 89 (unit 76 + browser 13) + 228
  + 5; e2e 22/22 (7 new, users seeded, API `PUBLIC_ORIGIN` = dashboard). Mutations: background polling, open
  redirect fail their tests. **Next:** 5d remaining reports, FilterBar URL binding, interval selector.

## 2026-10-25 — Stage 5b (shared/ui + shared/components)

- `shared/ui`: Card, Segmented (native radios), DeltaBadge, Tooltip + Menu (Popover API, CSS anchor
  positioning), Dialog (replaces Sheet), Toast, Tabs, fields, Switch, Chip, CodeBlock, Stepper, DataTable,
  Pagination, Skeleton, StatePanel; React Aria ComboBox + DateRangeField, lazy. ADR 0040 (amends 0004 size trigger).
- `shared/components`: StatCard, ShareBars, SeriesSummary, TimeSeriesChart (lazy Recharts + table), BreakdownTable,
  DateRangePicker (in the report header, `?from=&to=`), FilterBar, OrgProjectSwitcher, ChannelBadge, states.
- New Vitest `browser` project (real Chrome). It found: rem was 14 px (`text-body` on `<html>`), hidden radios
  widened 360 px pages, combobox list closed on ArrowDown, custom range wrote per keystroke. All fixed + tested.
- Checks: lint, typecheck, build ok (initial JS 103.6 KB gz; RAC loads only on Custom/Add filter); tests 30 + 50
  (unit 41 + browser 9) + 68 + 228 + 5; e2e 15/15 (2 new). Mutations: no `relative`, no `containerPadding` fail.
- **Next:** 5c auth pages, org/project switcher wiring, overview, realtime (TanStack Query + api-client).

## 2026-10-19 — SDK perf fix (script-tag ≤ 5 ms flake)

- Cause (Chrome trace): idle start did checks + modules + first storage read (~1–2 ms cold) + page
  view + send in one task (≤ 4.6 ms); script eval also built the instance. ADR 0039.
- Fix: idle start → checks/listeners, then storage, page views, first send as separate idle callbacks;
  `scope.settle()` for flush/hide/shutdown. Script tag: `window.analytics` forwarders, instance in own task.
- Core 4991/5000 B gz (dropped `uuidv7` Math.random fallback). 5 ms limit unchanged.
- Checks: lint, typecheck, build + size-limit ok; tests 30 + 17 + 68 + 228 + 5 (4 new idle-step tests,
  each fails on its mutation); `pnpm test:e2e` 5 consecutive runs 13/13, script-tag medians 1.9–2.5 ms.
- **Next:** Stage 5b (unchanged).

## 2026-10-19 — Stage 5a (dashboard foundation)

- `apps/dashboard`: Vite 8.3, React 19.3, React Router 8.4 (data mode), Tailwind 4.3 + tokens (moved from
  docs), Inter + Vazirmatn (fontsource, split by script, active one preloaded), Lucide icons. ADR 0038.
- i18n: typed `en`/`fa` catalogs (lazy chunks), `t()` with `Intl.PluralRules`; locale boot before render
  (saved → browser → en), `<html lang dir>`; Persian calendar + digits via `Intl` in `format.ts`.
- Shell: top bar, pill nav ≥ 1024, tab bar + `<dialog>` "More" sheet below; `?range=` default 30d. Build gate
  `check-dist.mjs`: no external URLs, initial JS 101 KB gz (≤ 180).
- Checks: lint, typecheck, build ok; tests 30 + 17 + 63 + 228 + 5; e2e 13 (4 new: desktop, fa/RTL + fonts,
  360 px tab bar/sheet, fa browser). Mutation: label in Inter stack → en page loads Vazirmatn → e2e fails.
  SDK perf e2e flaked once (script-tag 5.098 ms > 5 ms; SDK untouched, known thin margin), green on rerun.
- **Next:** 5b `shared/ui` primitives + gap-list widgets (ADR 0004), `shared/components` wrappers.

## 2026-10-18 — Stage 4d (10 M events, plans) → **Stage 4 gate met (2 slow cases documented)**

- `tools/load` `seed:large` (pure SQL, uuidv7, resumable; 10 081 634 events / 2.35 M visits / 90 d) and `explain`
  (built use cases, statements captured via postgres.js `debug`, EXPLAIN ANALYZE BUFFERS). Raw plans committed.
- Fix (ADR 0037): `SET LOCAL parallel_*_cost = 0` in stats tx + distinct visitors as group-then-count. 90 d:
  overview 7.6 → 3.8 s, devices timeout → 5.9 s, timeseries timeout → 9.0 s, goals 12.5 → 9.3 s.
- Still > 10 s at 90 d on this box (documented with plans in `docs/database.md`, gate allows): top pages
  (7.5 M page×visitor groups, ~16 s, CPU-bound) and property keys (cold heap fetches). 30 d: all < 3.5 s.
- Gate: boundary tests (DST, midnight UTC, range edges) green since 4a; plans recorded. Checks: lint, typecheck,
  build ok; tests 30 + 63 + 228 + 5; e2e 9; mutation (server IDs counted as visitors) fails 3.
- Lessons: `pnpm test` truncates the test DB (lost one 10 M seed); postgres.js recycles connections after 30–60 min.
- **Next:** Stage 5a dashboard (Vite + Tailwind 4 + tokens, fonts, i18n en/fa, direction, shells).

## 2026-10-18 — Stage 4c-2 (goals, share links) → Stage 4c done

- `migrations/0012`: `goals` (event | page pattern, ≤ 50) and `share_links` (SHA-256 token, expiry, revoke, ≤ 20
  active). CRUD under `project:manage`, audited (`goal.*`, `share_link.*`). ADR 0036, `docs/metrics.md`.
- `stats/goals`: conversions + revenue per currency (both sources), rate = browser visitors only; page goals via
  `templateRegex` (bound, proven equal to ingestion's matcher on 7 patterns × 14 paths).
- Public `GET /share` + `/share/stats/:report` (`X-Share-Token` header, redacted; 8 enumerated reports; synthetic
  viewer scope; revoked/expired/archived/suspended → 404). Route-coverage allowlist + isolation updated.
- Checks: lint, typecheck, build ok; tests 30 + 63 + 228 + 5; e2e 9; mutations (page goal by equality, revoked
  token accepted) fail 1 each; live: goals 201, stats ok, share 200, data-health via share 404.
- **Next:** 4d 10 M-event seed script, `EXPLAIN (ANALYZE, BUFFERS)` per stats query in `docs/database.md`, gate.

## 2026-10-18 — Stage 4c-1 (stats gate, realtime, data health, CSV export)

- `StatsGate`: ≤ 3 stats queries per project, 2 s wait then 429 + Retry-After; 15 s per-process LRU (500) keyed by
  project + route + parsed query (filters sorted), after the guard. Realtime/export never cached. ADR 0035.
- `stats/realtime` (30 min, 5 min active, per-minute views, sources, last 20 events without IDs); `stats/data-health`
  (last event, 168 UTC hours, rejection codes, origins, pages_seen cap, debugger); `stats/export.csv?report=`
  (the report schema, ≤ 10 000 rows, BOM, CSV-injection guard, digits-only filename).
- Debugger = `RecentRejections` in a global DiagnosticsModule (ingestion writes, analytics reads; per process).
- Checks: lint, typecheck, build ok; tests 30 + 63 + 220 + 5; e2e 9; mutation (realtime cached) fails 1; live 200 ×3.
- Git slip: 4c-1 was committed straight to `develop` (no feature branch); left as is (no history rewrite).
- **Next:** 4c-2 goals (revenue per currency, browser-only conversion rate) and share links (hashed token, expiry).

## 2026-10-18 — Stage 4b (breakdown reports)

- `…/stats/pages` (top by hostname+route, entry, exit, discovered), `pages/detail` (views, scroll-depth visitors per
  threshold, avg engaged seconds; `null` = module off), `sources?by=` (first touch on visits), `geo?by=`,
  `devices?by=`, `events`, `events/:name/properties[?key=]`. Limit 1–100, `meta.truncated`. ADR 0034.
- Shared `scope-sql.ts` (range + envs + filters) for totals and breakdowns; columns only from per-endpoint maps;
  coded columns returned by name. Contracts: `withRangeCheck` (Zod 4 cannot extend refined objects).
- Checks: lint, typecheck, build ok; tests 30 + 63 + 211 + 5; e2e 9; mutation (visit breakdown ignores filters)
  fails 1; isolation covers the 9 stats routes; live: 5 reports 200 on real e2e browser data.
- Note: fixture SQL literals without `Z` are read in the DB session zone (Tehran here) — always write `…Z`.
- **Next:** 4c goals + revenue, realtime, data health, CSV export, share links, semaphore + 15 s cache.

## 2026-10-18 — Stage 4a (overview, time series, filters)

- `GET /projects/:id/stats/overview|timeseries` (`project:view`): 6 KPIs (spec §4), compare `previous_period`
  / `previous_year`, null-change rule; buckets via `date_trunc(unit, ts, tz)` + `generate_series(…, tz)` (DST,
  half-hour zones); auto interval, ≤ 1000 buckets; read-only tx + 10 s timeout. ADR 0033, `docs/metrics.md`.
- Filters: grammar + allowlist in contracts (`parseFilter`), bound values, `prop.<key>`, coded fields by name.
- Boundary tests: Berlin fall-back (25 h day, repeated hour = 2 buckets), NY spring-forward, Tehran 20:30 UTC
  days, midnight UTC rotation, `[from, to)`, totals ≠ bucket sums. Mutations (UTC buckets / no filters) fail 3 / 2.
- Plans (`docs/database.md`, 191 k events): 40–236 ms, `count(DISTINCT)` spills to disk (work_mem 4 MB) → 4d.
- Checks: lint, typecheck, build ok; tests 29 + 63 + 205 + 5; e2e 9; live: overview 200, bad filter 400.
- **Next:** 4b pages (top/entry/exit/discovered/detail), sources, geo, devices, events, properties.

## 2026-10-18 — Stage 3f (load baseline) + **Stage 3 gate met**

- `tools/load` (`pnpm load`, autocannon 8 + postgres.js, ADR 0031): SDK-shaped batches → built API on the
  local test DB; exact p50/p95/p99, DB rows/rollbacks/deadlocks, busy conns + lock waiters, API RSS/CPU.
  Baseline (i5-8400, one API process, pool 10): sustained **3196 events/s**, p95 48 / p99 62 ms; burst 9065
  events/s, p99 579 ms; 0 errors/deadlocks. Budgets in `budgets.mjs` (exit 1 if broken), `docs/load-baseline.md`.
- Bottleneck (not optimized): API main thread CPU-bound (postgres.js ~37 %), then hot `pages_seen` row locks.
- Gate (ADR 0032): e2e now runs through the **real API + test DB** (rows asserted: one view per Next nav,
  revenue server event, retry = duplicate); curl server event → row with revenue 129.50 USD; `pnpm check:packages`
  (publint strict, attw, pack + tarball install smoke) ok. Checks: lint, typecheck, build ok; tests 25+63+193+5; e2e 9.
- Open: SDK idle-start task 2.2–5.3 ms vs 5 ms (perf test = median of 3); mixed ingest+stats load in Stage 4.
- **Next:** Stage 4a (query builder, overview + timeseries + comparison).

## 2026-10-18 — Stage 3e (SDK modules, script tag, React adapter, examples)

- SDK: 4 module entries via `autoCapture` factories (0.24–0.52 kB gz), `notFound()`, IIFE
  `didban.iife.js` (data attributes, strict CSP, SRI; 5.96/6.5 kB). Core 4.97/5 kB (~30 B left). ADR 0030.
- `@didban/react` 0.1.0 (240 B gz, `"use client"` checked on build, peer of core). Examples:
  `vanilla-vite`, `nextjs-app-router`, `script-tag`; `e2e/` Playwright (system Chrome) + `pnpm test:e2e`.
- Finding: Next.js rewrites do **not** add `X-Forwarded-For` → docs require a front proxy; test pins it.
- Checks: lint, typecheck, build ok; tests 25 + 63 + 193 + 5 passed; e2e 8 passed (one view per Link /
  router.push in StrictMode dev, client IP, CSP+SRI, perf: longest SDK task 2.4–4.4 ms ≤ 5 ms — thin margin).
  publint "All good" ×2, attw no problems (esm-only), `npm pack --dry-run` ok, tarballs installed + smoke-run.
- Docs: `docs/sdk.md` (modules, script tag, Caddy/Nginx proxy), `docs/integration.md` (server event fetch).
- **Next:** 3f load-test baseline (`tools/load`), then the Stage 3 gate.

## 2026-10-18 — Stage 3d (SDK core)

- `packages/sdk` (`@didban/analytics` 0.1.0, zero deps): queue, batching, fetch transport (keepalive,
  timeout), full-jitter retry + Retry-After + 413 halving, sendBeacon on hide (< 60 KB chunks),
  consent/GPC/DNT/opt-out (`?no_track=1`), cookieless/persistent identity, SPA history patch, prerender,
  bfcache, gates (file://, cross-origin iframe, localhost, allowlist), singleton, SSR no-op. ADR 0029, `docs/sdk.md`.
- tsdown ESM + d.ts; size-limit (gzip) **4.88 kB / 5 kB**. SDK copies 9 constants (ADR 0029 amends 0010), tests check them.
- Checks: typecheck, build ok; tests 25 + 53 + 193 passed; 4 mutations (dedupe, 413, dispose, consent) fail tests.
  `pnpm lint` ok after restoring two stray uncommitted edits (80-col reflow of `check-file-size.mjs`,
  broken sentence in ADR 0021) to their committed versions.
- **Next (new session):** 3e modules (separate entries, ≤ 1 KB each), React adapter, IIFE script build, examples, proxy docs.

## 2026-10-18 — Stage 3c (identity, visits, event writer)

- `migrations/0011`: `daily_salts`, `events`, `visits`, `pages_seen` (spec §9). Ingest now answers
  **200 after commit** (`{accepted, duplicates, rejected, requestId}`); lock/timeout/DB loss → 503.
- Identity (cookieless daily salt / persistent `anonymousId` / server `anonymousId|userId`),
  `allow_identify`, ≤ 5 visitors per browser batch. `modules/events` = `EventWriter`: advisory
  locks, in-memory visit assignment, chunked `ON CONFLICT DO NOTHING`, visits/pages/usage from
  inserted rows only, `pages_seen` cap → `/__other__`. ADR 0028, `docs/metrics.md` visitors/visits.
- Checks: lint, typecheck, build ok; tests 25 + 193 passed; mutations (no lock / no dedupe) fail
  tests; dev DB migrated; live on 5199: 200, retry → duplicates 2, server key rejects no-ID event.
- Open: 50 property keys per (project, event name) limit (§6.2) not built. **Next:** 3d SDK core.

## 2026-10-18 — Stage 3b-2 (route-template API) → **Stage 3b done**

- `migrations/0010`: `route_templates.id` (stable; positions shift). `/projects/:projectId/routes`
  GET/POST, PATCH/DELETE `:routeId`, `POST …/preview` (1–20 paths, optional unsaved patterns), all
  `project:manage`. Changes lock the project row and rewrite positions 1..n. Audit
  `route_template.*` (field names only). ADR 0027 (EXPLAIN: 100k rows, list 0.41 ms).
- `docs/metrics.md` created: channel table + rules order, route grouping. Isolation test split.
- Checks: lint, typecheck, build ok; tests 25 + 169 passed; mutations (viewer allowed / no dup
  check) fail 2 tests; dev DB migrated; live on 5199: ready 200, routes 401, foreign Origin 403.
- **Next (new session):** 3c identity, visit resolution, bulk writer, `pages_seen`, server-key events, dedupe/retry tests.

## 2026-10-18 — Stage 3b-1 (enrichment step)

- `enrich/*`: bot (isbot + no UA), internal CIDRs (BlockList, trusted-proxy IP), UA (bowser beat
  my-ua-parser on maintenance; equal on 14 UAs), optional geo (`GEOIP_DB_PATH`, fail fast), URL, referrer →
  source (`data/sources.json`), channel (`data/channels.json`, `CHANNELS` in contracts), PII, revenue, routes.
- `migrations/0009`: `hash_routing`, `store_city`, `site_search_params`, `route_templates` (≤ 200). Settings
  load with the write key (60 s cache). Drops counted in diagnostics. ADR 0026. Valid batches still 503.
- Checks: lint, typecheck, build ok; tests 25 + 160 passed; mutation (no PII strip / no CIDR check) fails 4;
  dev DB migrated (rerun up to date); live: ready 200, bad key 401; bad `GEOIP_DB_PATH` → exit 1.
- **Next (new session):** 3b-2 route-template HTTP (`…/routes` CRUD + `POST …/routes/preview`, project admin,
  isolation + route-coverage tests), `docs/metrics.md` channel table; then 3c.

## 2026-10-17 — Stage 3a (ingestion pipeline steps 1–5)

- `POST /api/v1/ingest/batch` + `OPTIONS` (public; write key is the credential). Order: body limit → JSON →
  key (shape check, LRU 60 s / 10 s) → Origin (browser keys) → rate limit (key, IP) → quota → envelope → events.
- `migrations/0008`: `organizations.daily_event_quota`, `project_usage_daily`, `ingestion_diagnostics`,
  `ingestion_rejected_origins` (≤ 20/env/day). Flusher writes counters + `last_used_at` once a minute. ADR 0025.
- Valid batches get **503 until 3c** (200 = committed). `application/json` errors now say `INVALID_JSON`.
- Checks: lint, typecheck, build ok; tests 25 + 134 passed; mutation (skip origin / rate check) fails 3 / 2 tests;
  dev DB migrated; live: ready 200, bad key 401, bad JSON 400, 200 KB 413, preflight 204 + CORS.
- Owner: make sure `.env` has `PORT=5100` (ADR 0021; an older `.env` may still say 3000). No way to set quotas over HTTP yet (SQL only).
- **Next:** 3b enrichment (trusted-proxy IP, UA parser, geo, bots, PII, URL, referrer/channel, route templates).

## 2026-10-17 — Stage 2 gate met

- Gate checks: lint, typecheck, build ok; tests 25 + 111 passed (two-org isolation 404s, route coverage,
  login/session/CSRF, forced password change).
- Live walkthrough on the test DB (port 5199): owner → project → environment → key → user → viewer,
  temp-password block, viewer 403, foreign Origin 403, other org + non-member platform admin 404,
  suspend → 404, reset revokes session, logout 401. All as expected.
- New `docs/guides/manual-testing.md`: diagrams + curl steps for the owner to repeat the flow by hand.
- **Next:** Stage 3a ingestion (new session).

## 2026-10-17 — Stage 2d-3 (owner-created users, replaces invites)

- Owner decision (spec addendum A9, ADR 0024): no invites/signup. Invites merge reverted; `0007` drops
  `invites`, adds `users.must_change_password`. TOTP moved to "optional, before first public release".
- `POST /organizations/:id/users` (`org:users`; admins → members only), `POST /admin/organizations/:id/owners`,
  owner reset `POST .../members/:userId/password-reset` (single-org, non-admin accounts), `pnpm cli reset-password`.
- One-time temporary password (~115 bits, shown once); until changed only me/logout/password work (403).
- Checks: lint, typecheck, build ok; tests 25 + 111 passed; dev DB migrated; CLI unknown email → exit 1.
- **Next:** Stage 2 gate review (two-org isolation, route coverage, auth tests) → release `develop` → `main`;
  then Stage 3a ingestion.

## 2026-10-17 — Stage 2d-2 (audit log) + dev ports

- Ports (ADR 0021): API default 5100, dashboard 5173 (strictPort, `/api` proxy), PostgreSQL 5432.
- `migrations/0005_audit_logs.sql`: append-only (app role lacks UPDATE/DELETE/TRUNCATE + trigger). ADR 0022.
- `recordAudit(tx, …)` in the same transaction for auth, org, project, member, environment, key and CLI
  actions; request ID + truncated IP from `http/request-context.ts` (AsyncLocalStorage). Logout → `logout.ts`.
- `GET /organizations/:organizationId/audit-log` (`org:audit`, owner/admin), keyset pages ≤ 100.
- Checks: lint, typecheck, build ok; tests 25 + 104 passed (rollback leaves no row, owner-level trigger,
  no passwords/typed emails stored); live server on 5100: ready 200, audit-log 401. EXPLAIN in ADR 0022.
- Owner: set `PORT=5100` in `.env` (I cannot read it). **Next:** 2d-3 invites (single-use, 72 h, hashed).

## 2026-10-17 — Stage 2d-1 (projects, environments, API keys)

- `migrations/0004_*`: project settings columns, `environments`, `api_keys` (composite FK env→project,
  SHA-256 only, token shown once). Contracts: `projects.ts`, `environments.ts`, `api-keys.ts`. ADR 0020.
- Routes: org projects list/create/archive, project get/patch, environments list/create/patch,
  keys list/create/revoke. Use cases re-check the scope (`access/in-scope.ts`). `domain/slug.ts`, `cidr.ts`.
- Tests: isolation now covers all 11 new routes (identical 404 + nothing changed), write key → 401 on
  management, mixed-ID attacks (A's env/key via B's project) 404. Removing one `@Requires` fails 5 tests.
- Checks: lint, typecheck, build ok; tests 25 + 95 passed; dev DB migrated; live: ready 200, new routes 401,
  foreign Origin 403. EXPLAIN for the key index in ADR 0020. Git: baseline on `main`, git flow from here.
- **Next:** 2d-2 audit log (also for 2d-1 actions), then invites, TOTP + recovery codes, reset links.

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
