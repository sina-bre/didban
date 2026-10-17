## 22. Addendum (owner requirements added 2026-10-17; overrides §0–21 where they conflict)

### A1. Simplicity and file size (hard rule)
- **Every source file targets ≤ 100 lines.** Soft limit 120 (CI warning), hard limit 150 (CI failure).
  Exempt: generated code, SQL migrations, `data/*.json`, test files (hard limit 250), vendored skill files.
- Functions ≤ 40 lines, ≤ 3 positional params (use an options object beyond that), nesting depth ≤ 3.
- One responsibility per file. A NestJS module folder is `*.module.ts` + `*.controller.ts` + `*.service.ts`
  (+ `*.repository.ts` only at the boundaries listed in §5.2) + `*.schema.ts`. If a service grows past
  100 lines, split by use case (`create-project.ts`, `archive-project.ts`), not by technical layer.
- React: one component per file, ≤ 100 lines. Data fetching lives in `use-*.ts` hooks, not in components.
  Pages compose; they do not compute.
- No abstraction without a second real caller. No generic base classes, no "utils" dumping grounds:
  name helpers by what they do (`format-number.ts`, `parse-filter.ts`).
- Enforced by `scripts/check-file-size.mjs` in `pnpm lint` (Stage 1).

### A2. Performance budgets (host sites come first)
The SDK runs on other people's sites (React, Next.js, plain HTML). It must never be the reason they get slower.
- Core ≤ 5 KB gz, each module ≤ 1 KB gz, React adapter ≤ 1 KB gz (§8.3; `size-limit` fails the build).
- **Zero runtime dependencies** in `@didban/analytics`. **No Zod in the SDK bundle**: the SDK has hand-written
  types and a contract test validates its output against `packages/contracts` (ADR 0010).
- Init work is deferred: `createAnalytics` does no network and no DOM reads synchronously; the first page view
  is queued and flushed on idle (`requestIdleCallback`, `setTimeout` fallback). No long tasks > 5 ms
  (measured with a Playwright performance trace in Stage 3).
- No layout reads in hot paths; scroll depth uses passive listeners + `requestAnimationFrame` throttling;
  all listeners `{ passive: true }` where applicable.
- Next.js: works with App Router and Pages Router, React 18 and 19 (`peerDependencies: react >=18`),
  RSC-safe (no browser globals at import; adapter entry carries `"use client"` and the build preserves it).
- Script-tag build loads with `defer` and never blocks rendering; Next.js docs use `next/script` with
  `strategy="afterInteractive"`.
- Dashboard: initial JS ≤ 180 KB gz, route-level code splitting, charts lazy-loaded, LCP ≤ 2.5 s on a
  mid-range mobile profile (Lighthouse, recorded in Stage 5). Fonts preloaded only for the active script.
- Backend: budgets come from the first measured baseline (§16). No speculative caching or queues (§20).

### A3. UI source = design screenshots, not a code template
- `design/reference/01–07.webp` (dashboard "MoonRow" shots, desktop + mobile) are the visual reference.
  They are images, so there is nothing to vendor. §13.2 steps 1, 3, 6, 7 do not apply. Instead:
  we build our own small component set in `apps/dashboard/src/shared/ui/` following
  `docs/design-system/README.md` (ADR 0003).
- Do not copy the brand name, mascots or illustrations from the shots. Use the visual language only:
  layout, color roles, radius, density, hatched bars, dark tooltip, segmented control.
- The owner must confirm the shots may be used as design reference (open question in ADR 0003).
- The rules that stay in force: no shadcn/ui, no Radix kits, self-hosted assets only, thin domain wrappers
  in `shared/components`, gap list before building.

### A4. Internationalization without i18n libraries
- No i18next / react-intl / FormatJS. Use the platform: `Intl.NumberFormat`, `Intl.DateTimeFormat`,
  `Intl.RelativeTimeFormat`, `Intl.PluralRules`, `Intl.DisplayNames` (country/language names for free).
- Messages: one typed TS object per locale (`messages/en.ts`, `messages/fa.ts`), lazy-loaded with
  dynamic `import()`, read through a ~30-line `t()` helper with typed keys (ADR 0005).
- Direction: `<html lang dir>` set from the locale. Layout uses **logical properties only**
  (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Physical `left/right` utilities are
  banned by a lint check. Directional icons (arrows, chevrons) flip with `rtl:-scale-x-100`.
- Charts mirror their time axis in RTL only when the locale demands it; numbers stay LTR inside
  `<bdi>` / `dir="ltr"` spans.
- v1 ships `en` + `fa`. `fa` is the RTL proof; more locales are additive files.

### A5. Typography
- **Vazirmatn** (Arabic/Persian script) and **Inter** (Latin), both variable, OFL-1.1, self-hosted from
  `@fontsource-variable/*`, split with `unicode-range` so a page only downloads the scripts it renders (ADR 0006).
- Tabular figures (`font-variant-numeric: tabular-nums`) for every metric, table and axis.

### A6. Mobile first
- Every screen is designed at 360 px first, then `sm 640 / md 768 / lg 1024 / xl 1280`.
- Mobile layout follows shots 04–07: bottom tab bar (≤ 5 items, safe-area aware), stacked cards,
  horizontally scrollable segmented controls, tables collapse to label/value rows.
- Touch targets ≥ 44×44 px. No hover-only affordances. Use `dvh`, never `vh`, for full-height layouts.

### A7. Open source and npm readiness
- Publishable packages: `@didban/analytics` (SDK) and `@didban/react`. The scope is a single
  npm org `@didban` (ADR 0011). Private workspace packages use the same scope.
- Everything else (`apps/*`, `packages/contracts`) is `"private": true`.
- Releases through Changesets + GitHub Actions with npm provenance (trusted publishing). **Nothing is published
  without explicit owner approval.**
- Repo hygiene from Stage 1: `LICENSE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  conventional commits, no secrets in history (`.env*` ignored, `gitleaks`-style check in CI later).
- Public API of the SDK is semver-governed from 0.1.0; breaking changes need a changeset and a migration note.

### A8. No ORM (overrides the ORM row of §2 and §9.1 "Prisma-managed")
- Plain SQL with postgres.js and forward-only `.sql` migrations (ADR 0016). Same tables, same constraints.
