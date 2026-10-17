# 0006 — Fonts: Inter + Vazirmatn, self-hosted, split by script

- Status: Accepted
- Date: 2026-10-17

## Context
We need a clean pair that reads well in Latin and Persian/Arabic, supports RTL, has tabular numbers for
metrics, and is self-hosted (spec §2: no font CDNs). The reference shots use a neutral grotesk.

## Decision
- **Inter** (variable, OFL-1.1) for Latin: neutral, very legible at small sizes, true tabular figures, close to the shots.
- **Vazirmatn** (variable, OFL-1.1) for Arabic script: the most widely used open Persian UI font, drawn to sit
  next to Latin grotesks, full weight range.
- One stack: `"Inter Variable", "Vazirmatn Variable", system-ui, sans-serif`. Each `@font-face` has a
  `unicode-range`, so an English page never downloads Vazirmatn and a Persian page only fetches Latin glyphs if it renders them.
- `font-display: swap`. Preload only the active script's woff2.
- Installed from `@fontsource-variable/inter` and `@fontsource-variable/vazirmatn`; files emitted by Vite.

## Consequences
One or two woff2 files per page (size measured in Stage 5). Persian digits are a formatting choice
(`Intl.NumberFormat("fa-IR")`), not a font feature.
