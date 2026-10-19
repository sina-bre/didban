# 0038 — Dashboard foundation: router, locale boot, shells, range default

- Status: Accepted
- Date: 2026-10-19

## Context
Stage 5a builds `apps/dashboard` (spec §13, addendum A2–A6, ADRs 0004–0006). Several small choices are
not fixed by the spec: the router mode, how the locale is chosen and applied, one shell or two, the
default report range, and how the "self-hosted only" and 180 KB budgets are enforced.

## Decision
- **React Router 8, data mode** (`createBrowserRouter` + `RouterProvider` from `react-router/dom`), not
  framework mode: the dashboard is a static SPA served by Caddy, no SSR. Routes live in `app/routes.tsx`.
- **Locale boot before first render**: saved choice (`localStorage` `didban.locale`) → browser languages
  (`fa*` → `fa`) → `en`. `<html lang dir>` is set and the catalog is awaited (top-level `await`) before
  React renders, so RTL never flashes as LTR. Catalogs are separate chunks (`import()`).
- **Fonts**: the active script's primary woff2 is preloaded at boot (`?url` import of the same fontsource
  file). The language switch shows the other language's name in `system-ui` (`font-system` token), so an
  English page never downloads Vazirmatn just for the word "فارسی" (verified by E2E).
- **One responsive shell**: top bar everywhere; pill nav from `lg` (1024); bottom tab bar (4 reports +
  "More") below it. "More" is a native modal `<dialog>` bottom sheet with `closedby="any"` (light dismiss
  by the browser; Escape and the close button work everywhere).
- **Default range 30 days** (`?range=` presets today/7d/30d/90d; unknown → 30d). 90 days stays available
  but top pages / property keys exceed 10 s at 10 M events (ADR 0037). Section links keep the search.
- **Build gate** `scripts/check-dist.mjs` (part of `pnpm build`): fails on an external URL in
  `index.html` or CSS, or initial JS > 180 KB gz. Baseline: 101 KB gz (React, router, icons).
- Token additions: `--container-content` (1440 max width), `--font-system`. Tokens moved to
  `apps/dashboard/src/shared/ui/tokens.css` (one copy).

## Consequences
No auth, data or project switcher yet: `/projects/:id/:section` renders the report frame for any id until
5c loads projects (a missing/forbidden project then renders not found). A browser without `closedby` support
ignores the attribute: the backdrop tap then does nothing, Escape and the close button still work
(support matrix checked in the 5f a11y pass). Revisit the browser-language default if the
owner wants `fa` first for everyone.
