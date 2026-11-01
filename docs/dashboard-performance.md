# Dashboard performance and accessibility (Stage 5f)

Budgets (addendum A2): initial JS ≤ 180 KB gz, LCP ≤ 2.5 s on a mid-range phone. ADR 0044 has the method.

## Method
- `pnpm build`, then `pnpm -C e2e lighthouse` (`LH_ONLY=overview,pages` narrows it). The production
  build on `vite preview` (HTTP/1.1) with the e2e API and seeded DB; signed in through a cookie header.
- Lighthouse 13.6.0, default mobile profile: simulated slow 4G (150 ms RTT, 1.6 Mbps), 4× CPU, Lantern.
  Three runs per page; the tables show all three (LCP, TBT) because one median hides the spread below.
- Before = `develop` at 26041c9 (end of 5e), after = this branch, same box, same day (2026-11-01).
- The a11y score is Lighthouse's; the full audit is `e2e/tests/dashboard-a11y.spec.ts` (axe WCAG 2.2 AA,
  every page in `fa` at 360 and 1280 px, no sideways scroll, 44 px targets): 3/3 pass after.

## Results
| Page | LCP before (s) | LCP after (s) | TBT before (ms) | TBT after (ms) | CLS before → after | a11y before → after |
|---|---|---|---|---|---|---|
| Login | 0.78 / 0.77 / 0.79 | 0.81 / 0.78 / 0.77 | 111 / 20 / 185 | 73 / 43 / 17 | 0 → 0 | 1.00 → 1.00 |
| Overview (en) | 3.78 / 3.78 / 4.33 | 2.88 / 3.03 / 2.91 | 251 / 230 / 304 | 111 / 230 / 184 | 0.14 → 0–0.04 | 0.90 → 1.00 |
| Pages | 3.50 / 3.50 / 3.51 | 0.78 / 0.77 / 0.78 | 126 / 160 / 138 | 271 / 162 / 149 | 0.04 → 0–0.003 | 0.96 → 1.00 |
| Sources | 3.68 / 3.66 / 3.64 | 1.31 / 0.77 / 2.99 | 174 / 182 / 133 | 145 / 136 / 128 | 0.04 → 0–0.04 | 0.96 → 1.00 |
| Overview (fa) | 4.66 / 4.36 / 4.40 | 0.77 / 3.15 / 0.76 | 569 / 251 / 317 | 1312 / 291 / 261 | 0.16 → 0–0.04 | 0.90 → 1.00 |

Initial JS: 130.8 KB gz in 25 files before, 135.3 KB gz in 13 files after (budget 180).
`LH_ARGS=--throttling-method=devtools` (applied throttling, real network delays): Overview LCP
4.07 s (en), 4.22 s (fa), FCP 3.7–4.0 s, so that mode is slower everywhere and is not the A2 number.

## What changed
- Contracts side-effect free, report ranges on `Intl` (Zod and `@internationalized/date` off the path).
- First screen's reads start with the code (`app/prefetch.ts`); Recharts loads when the chart is near.
- Skeletons measured per breakpoint (CLS); one `icons` and one `core` chunk (18 → 13 initial files).
- a11y: darker muted text, `dl` structure, names that hold the visible text, 44 px links and selects.

## Verdict: LCP budget not met on Overview
Pages, Sources and Login meet 2.5 s (Sources' 2.99 s run is the spread described next). Overview does
not: en is 2.9–3.0 s in every run. Its LCP element is the cookieless note under the KPIs, shown when
the overview report answers, so LCP is the end of a serial chain: JS → `project` (for its reporting
zone) → three stats reads → paint. Lantern charges each hop with slow-4G round trips and queues the
requests on HTTP/1.1's six connections; production runs behind Caddy with h2. In fa two of three runs
show 0.77 s for the same element: Lantern sometimes leaves the data requests out of the LCP graph,
which is also why Sources varies. Next steps, not in 5f: a stats query that takes a relative range and
resolves it in the project's zone (removes the `project` hop), and measuring behind Caddy (Stage 6).
