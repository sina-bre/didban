# packages/sdk — browser SDK rules

Spec: `docs/spec/06`, `08`, `22` (A2, A7). This code runs on other people's sites. Their speed comes first.

- **Zero runtime dependencies. No Zod.** Types are hand-written; `contract.test.ts` validates SDK output
  against `packages/contracts` (ADR 0010). Published `.d.ts` must not import private workspace packages.
- Budgets (size-limit, fail the build): core ≤ 5 KB gz, each module ≤ 1 KB gz, react adapter ≤ 1 KB gz.
- Never throw, never block. Wrap every public method. Defer first send to idle time.
- SSR-safe: no `window`/`document` at import time. Works in Next.js App Router + Pages Router, React 18/19.
- Modules (`outbound-links`, `file-downloads`, `scroll-depth`, `engaged-time`) are separate entry points,
  tree-shakeable, `sideEffects: false`.
  They are `Module` functions passed as `autoCapture` values (ADR 0030). Core is at 4.97/5 kB gz:
  measure (`pnpm -C packages/sdk size`) before adding anything to core. `@didban/react` lives in
  `packages/react` (peer of this package); examples are checked by `pnpm test:e2e`.
- Passive listeners; rAF-throttled scroll; no layout reads in hot paths; no DOM text or form capture.
- Every lifecycle edge case in spec §8.3 has a test (jsdom + fake timers).
- Before any release: `npm pack --dry-run`, `publint`, `attw`, size-limit, install the tarball in an
  empty project. Never publish without owner approval.
