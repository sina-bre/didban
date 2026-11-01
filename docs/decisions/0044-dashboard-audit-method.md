# 0044 — Dashboard audit: axe, Lighthouse method, darker muted text

- Status: Accepted
- Date: 2026-11-01

## Context
Stage 5f (`docs/plan/phases.md`) needs an a11y audit, an RTL pass in `fa` and Lighthouse mobile
numbers against addendum A2 (LCP ≤ 2.5 s on a mid-range phone, initial JS ≤ 180 KB gz). We need a
repeatable check, not a one-off review, and one way to measure that later stages reuse.

## Decision
**axe.** `@axe-core/playwright` (pinned, `e2e` devDependency only, never shipped) runs the WCAG 2.0–2.2
A/AA rules on every dashboard page in `fa` at 360 and 1280 px (`e2e/tests/dashboard-a11y.spec.ts`,
part of `pnpm test:e2e`), together with our own checks: `dir="rtl"`, no sideways scroll, and 44 × 44 px
targets on phones (inline text links exempt, WCAG 2.5.8). Each fix also gets a unit or browser test.
**Lighthouse.** `pnpm -C e2e lighthouse` runs the pinned CLI (`pnpm dlx lighthouse@13.6.0`, a tool, not
a dependency) on the production build served by `vite preview` with the e2e API and seeded DB:
default mobile profile (simulated slow 4G, 4× CPU, Lantern), median of 3 by LCP, signed in through a
cookie header. `LH_ARGS=--throttling-method=devtools` gives the applied-throttling view for comparison.
Results are recorded in `docs/dashboard-performance.md`; the run is a measurement, not a CI gate.
**Muted text.** `--color-slate-500` goes from `#6b7385` (4.7:1 on white, 4.4:1 on the canvas, which axe
flagged) to `#5f6779` (5.7:1 on white, 5.1:1 on canvas). Same hue, a step darker.

## Consequences
Every new page joins the axe spec, so contrast, names and target sizes stay checked. Lighthouse
simulated numbers on `vite preview` (HTTP/1.1, one origin) are pessimistic for production (Caddy, h2):
Lantern charges request queuing that h2 removes. Revisit the method when production runs behind
Caddy in Stage 6 (measure there), and the Overview LCP when the stats API can resolve a relative
range itself (that removes the project round trip before the reports).
