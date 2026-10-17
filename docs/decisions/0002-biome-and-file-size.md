# 0002 — Biome for lint/format, plus file-size and logical-CSS checks

- Status: Accepted
- Date: 2026-10-17

## Context
Spec wants lint + format. Owner wants simple tooling and small files (addendum A1).
ESLint + typescript-eslint + Prettier is three tools and many plugins, and typescript-eslint does not support TS 7.

## Decision
Biome 2 for lint and format (one binary, fast). Two small scripts in `scripts/`, both run by `pnpm lint`:
- `check-file-size.mjs`: 120 lines warn, 150 fail; tests 250 fail; generated code and migrations exempt.
- `check-logical-css.mjs`: bans `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`,
  `rounded-l/r-`, `border-l/r-` in the dashboard and examples (RTL safety).

## Consequences
Fewer rules than the ESLint ecosystem (no import-boundary plugin). Module boundaries are kept by Biome's
`noRestrictedImports` per folder plus review. Revisit if a boundary violation slips through twice.
