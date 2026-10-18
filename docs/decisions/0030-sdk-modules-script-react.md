# 0030 — SDK modules, script-tag build, React adapter, examples

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 3e (spec §8.3–8.5, §8.8, addendum A2, feature catalog §23.1). The core had ~110 B of its
5 KB gzipped budget left (ADR 0029), but the spec's `autoCapture.outboundLinks: true`-style
booleans cannot be tree-shaken: the core would have to import every module.

## Decision
- **Modules:** four entry points (`@didban/analytics/outbound-links`, `file-downloads`,
  `scroll-depth`, `engaged-time`). The `autoCapture` option takes the module's factory instead of
  `true` (`autoCapture: { scrollDepth: scrollDepth() }`). Core runs every function value of
  `autoCapture` once at start with `(emit, on)`; a module may return a callback that runs before
  each page view. Modules start before the page-hide listeners so their hide events go into the
  beacon. Cost in core: ~90 B (4.97 of 5 kB gz). Modules: 0.24–0.52 kB gz each.
- **Events:** `outbound_click` / `file_download` with `url` = origin + path (no query, no
  fragment, ≤ 255), `scroll_depth` with `percent` once per threshold per page view (measured on
  scroll only), `engaged_time` with `seconds` (visible + focused, sent on page change and hide).
- **`notFound(analytics, path?)`:** a separate exported function in the main entry (tree-shaken
  when unused, 0 bytes in core), not a method: a method would have cost ~40 B of core budget.
- **Script tag:** `dist/didban.iife.js` = core + all modules (5.96 kB gz, budget 6.5 kB). Config
  from `data-*` only (strict CSP, no inline script). `window.analytics` = instance + `notFound`.
  Listed under `unpkg`/`jsdelivr`, not in `exports` (attw requires types for every export).
- **`@didban/react`:** `AnalyticsProvider` creates the instance in a `useState` initializer (so
  children can track in their mount effects); the core singleton absorbs StrictMode. No shutdown
  on unmount (HMR would count a second page view). `@didban/analytics` is a peer dependency so
  there is one core copy and one singleton registry. 240 B gz. `"use client"` kept by Rolldown,
  checked by `scripts/check-directive.mjs` on build.
- **Next.js client IP:** rewrites pass `X-Forwarded-For` through but do not add the visitor's
  address (verified, pinned in `e2e/tests/nextjs.spec.ts`). Docs require a front proxy (or
  routing `/a/e` in it straight to the collector) and `TRUST_PROXY` = hops.
- **E2E:** one Playwright package `e2e/` (system Chrome, `channel: "chrome"`, no browser download)
  with a recording collector and a front-proxy stand-in (test fixtures only). Performance: a Chrome
  trace; every script task attributed to SDK code must be ≤ 5 ms.

## Consequences
Core has ~30 B left; new core features need a size check or must be modules. The `autoCapture`
module values differ from the spec's booleans (documented in `docs/sdk.md`). Examples type-check
against built `dist` types, so `pnpm build` must run before their `typecheck`. Revisit the Next.js
caveat if Next.js starts adding `X-Forwarded-For` on rewrites (the pinned test will fail).
