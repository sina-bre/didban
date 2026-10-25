# 0004 — Accessible primitives: native HTML first, React Aria Components for the hard widgets

- Status: Accepted (owner approved "most optimized way", 2026-10-17; overrides spec §13.2.2 for these widgets only). Size trigger amended by 0040
- Date: 2026-10-17

## Context
With no code template (ADR 0003), we build the gap list ourselves: date-range picker, combobox, menu, tabs,
dialog, toast, tooltip. Hand-rolled keyboard and focus handling for a date-range picker or combobox is where
accessibility bugs come from. We also need RTL and, for `fa`, a Persian calendar option.

## Decision
1. Native first: `<dialog>` for modals, Popover API for simple popovers, `<details>` for disclosure,
   `<table>` for tables, styled native inputs for toggles.
2. **react-aria-components** (Adobe, Apache-2.0, unstyled, not Radix), only for DateRangePicker/RangeCalendar
   and ComboBox, lazy-loaded with the filter bar. Menu, Tabs and Tooltip start native/hand-built (small, APG
   pattern + Playwright keyboard test); switch one to React Aria only if its hand-built version fails a11y tests. Imported per component (tree-shaken) and styled with our tokens.
   It handles RTL and non-Gregorian calendars (`@internationalized/date`, including Persian).
3. No shadcn/ui, no Radix, no Base UI. Skill advice that says otherwise is overridden (CLAUDE.md precedence).

## Consequences
Roughly 25–40 KB gz extra on routes that use the picker (to be measured in Stage 5; lazy-loaded with the filter bar).
Revisit if the measured picker chunk exceeds 40 KB gz: then replace it with a hand-built APG date grid.
