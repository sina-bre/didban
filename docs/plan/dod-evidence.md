# Definition of Done: command evidence (2026-11-02)

Run on the dev box (Windows 10, i5-8400, Node 24.18.0, pnpm 11.21.0, PostgreSQL 18.4) at commit
bf29192 + this report, branch `claude/practical-babbage-620d3e`. Order as required: lint,
typecheck, build, test, E2E. **Every command passed on its first run today; no rerun was needed.**
Output trimmed to the summary lines, not edited.

## pnpm lint (exit 0)
```
Checked 761 files in 1799ms. No fixes applied.
warn  apps/dashboard/test/settings.browser.tsx: 121 lines (target 100)
warn  tools/load/src/explain-jobs.mjs: 128 lines (target 100)
check-file-size: ok (2 warning(s))
check-logical-css: ok
```
## pnpm typecheck (exit 0)
```
examples/nextjs-app-router typecheck: ✓ Types generated successfully
examples/nextjs-app-router typecheck: Done
```
## pnpm build (exit 0)
```
packages/sdk build:   core                 Size limit: 5 kB    Size: 4.99 kB  (min + gzip)
packages/sdk build:   notFound             Size limit: 1 kB    Size: 188 B
packages/sdk build:   outbound-links       Size limit: 1 kB    Size: 328 B
packages/sdk build:   file-downloads       Size limit: 1 kB    Size: 518 B
packages/sdk build:   scroll-depth         Size limit: 1 kB    Size: 242 B
packages/sdk build:   engaged-time         Size limit: 1 kB    Size: 249 B
packages/sdk build:   script-tag (core + all modules)  Size limit: 6.5 kB  Size: 6.06 kB
packages/react build: react adapter        Size limit: 1 kB    Size: 240 B
apps/dashboard build: check-dist: ok (no external URLs; initial JS 135.6 KB gz in 14 file(s))
examples/nextjs-app-router build: ○  (Static)  prerendered as static content
```
## pnpm test (exit 0)
```
packages/contracts  Test Files  8 passed (8)    Tests  40 passed (40)    1.57s
packages/sdk        Test Files 12 passed (12)   Tests  68 passed (68)   44.78s
apps/dashboard      Test Files 30 passed (30)   Tests 156 passed (156)  72.19s
apps/api            Test Files 53 passed (53)   Tests 255 passed (255) 248.04s
packages/react      Test Files  2 passed (2)    Tests   5 passed (5)     3.19s
```
## pnpm test:e2e (exit 0, after pnpm build)
```
  ok 35 tests\server-event.spec.ts:17:1 › server event with revenue lands once, retry counts as duplicate (26ms)
  ok 36 tests\vanilla.spec.ts:12:1 › pushState views, modules and the Vite proxy (production build) (6.4s)
  36 passed (3.9m)
```
## pnpm audit (exit 0) and pnpm audit --prod --audit-level high (exit 0)
```
No known vulnerabilities found
No known vulnerabilities found
```
Overrides that make it so: `pnpm-workspace.yaml`, ADR 0051.

## pnpm check:packages (exit 0)
```
publint --strict (packages/sdk)    All good!
attw --pack . --profile esm-only   node16 (from ESM): 🟢 (ESM)  bundler: 🟢  (CJS ignored: ESM-only by design)
publint --strict (packages/react)  All good!
npm install … ./didban-analytics-0.1.0.tgz ./didban-react-0.1.0.tgz react@19 react-dom@19
added 5 packages in 8s
smoke ok: function function (SSR no-op, use client kept)
check-packages: ok
```
## pnpm release:dry-run (exit 0, ADR 0052)
```
Packages to publish:
- @didban/analytics@0.1.0 (latest)
- @didban/react@0.1.0 (latest)
$ changeset version   (throwaway worktree, sample minor changeset for @didban/analytics)
@didban/analytics → 0.2.0
@didban/react → 0.2.0 { '@didban/analytics': '^0.2.0', react: '>=18' }
$ pnpm publish --dry-run --no-git-checks   (packages/sdk)
[WARN] Skip publishing @didban/analytics@0.1.0 (dry run)
$ pnpm publish --dry-run --no-git-checks   (packages/react)
[WARN] Skip publishing @didban/react@0.1.0 (dry run)
release dry run: ok (nothing published, tagged or pushed)
```
`pnpm changeset status` exits 1 here ("packages changed but no changesets"): expected, the local
`main` is behind develop and the 0.1.0 packages were never released.

## pnpm dev smoke (README quickstart)
```
api=200 dashboard=200 proxied=200     (/api/v1/health/ready, /, /api via Vite)
apps/api: Successfully compiled src\main.ts with swc (6.17ms) / Restarting 'dist/main.js'
```
Before the 6d fix the API watcher failed: `Error: Cannot find module 'chokidar'`.

## Elsewhere
Deployment, rolling restart, graceful shutdown, backup, restore: [deployment.md](../deployment.md#validation-record).
Load and abuse: [load-baseline.md](../load-baseline.md), raw JSON in `tools/load/results/`.
Stats plans: [database.md](../database.md).
