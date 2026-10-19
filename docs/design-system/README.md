# Design system

Extracted from `design/reference/01–07.webp` (ADR 0003). Tokens: [`tokens.css`](../../apps/dashboard/src/shared/ui/tokens.css).
Fonts: ADR 0006. i18n/RTL: ADR 0005. Primitives policy: ADR 0004.

## 1. Visual language (what makes it look like the reference)
- **Light gray canvas, white rounded cards, almost no shadow.** Depth comes from the canvas/card contrast.
- **Two-tone data palette:** orange (primary series) + deep navy (secondary) + slate (tertiary). Everything else is neutral.
- **Hatched fills** on bars, gauges and "remaining" tracks. They also separate series without relying on color (a11y).
- **Big confident numbers** (`display`/`metric`, tabular) with a small muted label underneath.
- **Card header:** 28 px navy circle with a white icon + title (16, medium) + optional muted subline
  ("Performing · 1h") + an action at the end (text link in `accent-text`, or a pill button).
- **Dark tooltip** (`inverse`): date, value, delta pill, a mini stacked share bar, and a legend.
- **Dashed row separators** in tables; column headers are muted and not bold.
- **Segmented pill control** on a `subtle` track; the active segment is a navy pill with white text.
- **Category marker:** a 3 px vertical bar in the series color before a label ("| Ducksource").

## 2. Layout
| | Mobile (< 768) | Tablet (768–1023) | Desktop (≥ 1024) |
|---|---|---|---|
| Shell | top bar (org switcher + 2 icon buttons) + **bottom tab bar** (≤ 5) | same as mobile | top bar: wordmark + **pill nav** + utility buttons |
| Grid | 1 column, gap 12 | 2 columns, gap 16 | 12-col grid, gap 20; side column 4/12 + main 8/12 |
| Card | radius `card-sm`, padding 16 | radius `card`, padding 20 | radius `card`, padding 24 |
| Tables | collapse to label/value rows, or horizontally scroll the numeric columns only | full | full |

- Content max width 1440 px. Fixed bars respect `env(safe-area-inset-*)`. Full-height uses `dvh`.
- Bottom tab bar items: Overview, Realtime, Pages, Sources, More (sheet with the rest + settings).
- The mobile "shortcut tiles" row (3 icons with labels, shot 06) is used for report shortcuts on Overview.

## 3. Component map (reference → our component → report)
| Reference element | Component (`shared/…`) | Used for |
|---|---|---|
| "184.160 Total Ticket Sales" + Details | `components/StatCard` (hero variant) | Overview primary KPI |
| Today's Increase gauge + 3 sub stats | `components/ShareGauge` (optional) | Realtime: active visitors by device |
| Hatched bars with % · count | `components/ShareBars` | Channels, devices, top sources |
| Orange line + area gradient + dark tooltip | `components/TimeSeriesChart` | Overview / events time series; compare = dashed slate |
| Footer row of 3 series stats under the chart | `components/SeriesSummary` | Totals per series in range |
| Top Performing Countries table | `components/BreakdownTable` | Pages, sources, geo, devices, events, properties |
| Daily / Weekly / Monthly / Annualy | `ui/Segmented` | Interval selector, view toggles |
| "GC Global Connect 37 Members ⇅" | `components/OrgProjectSwitcher` | Two-level org → project switcher |
| Pill nav (Dashboard, Ticket Sales…) | `ui/PillNav` | Report navigation (desktop) |
| Bottom tab bar | `ui/TabBar` | Report navigation (mobile) |
| +1,1% / −0,4% pills | `ui/DeltaBadge` | Comparison deltas; `null` renders "—" with a tooltip |
| "Get Report for ⌄" pill | `ui/Button` (outline pill) + menu | Export CSV, environment pick |
| Retention cohort bars | — | **Not built** (cohorts are out of scope, spec §3.3) |

Gap list (not in the reference, built in the same idiom): DateRangePicker, FilterBar chips, ComboBox,
Dialog, Toast, Skeleton, EmptyState, ErrorState (shows request ID), CodeBlock with copy, Stepper (onboarding),
Form fields, Tabs.

## 4. Rules
- **Color:** semantic tokens only. Orange is never used for body text on white; use `accent-text`.
  Muted text is `slate-500` (4.7:1). Up/down deltas pair color with a sign and an arrow icon.
- **Numbers:** `tabular-nums` everywhere; formatted via `format.ts` (`Intl`). Wrap numbers inside RTL text
  in `<bdi>`. Large numbers use compact notation on mobile (`12.4K`), full on desktop.
- **Charts:** Recharts, lazy-loaded. Max 3 series + compare. Series differ by color **and** hatch/dash.
  Every chart has a visible "View as table" toggle and labeled axes. Tooltip is keyboard reachable.
- **Motion:** 120–180 ms, `ease-out`, transform/opacity only, disabled by `prefers-reduced-motion`.
- **Focus:** 2 px `focus` ring with 2 px offset on every interactive element. Never removed.
- **Touch:** ≥ 44×44 px targets; ≥ 8 px between targets.
- **RTL:** logical properties only. Directional icons flip (`rtl:-scale-x-100`). The time axis stays
  left-to-right for `en` and mirrors for `fa` (owner can override in settings later).
- **Icons:** one self-hosted SVG set (Lucide, ISC license, imported per icon). No emoji as icons.
- **Light theme only** in v1 (reference has no dark mode).

## 5. Do not copy
The "MoonRow" name, the duck/glasses/ticket mascots, flags as decoration (flags in the geo table are fine,
self-hosted SVG), or any logo. Use the visual language only.
