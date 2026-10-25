# 0040 — Shared UI widgets: popovers, React Aria loading, range in the URL, browser tests

- Status: Accepted (amends ADR 0004's 40 KB revisit trigger)
- Date: 2026-10-25

## Context
Stage 5b builds `shared/ui` (primitives + gap list) and `shared/components` (spec §13.2.4, design
system §3, ADR 0004). Several things the spec leaves open: how native popovers are placed, how big
the React Aria chunks may be, the URL shape of a custom range, and how to test layout and keyboard
behaviour that jsdom cannot see.

## Decision
- **Popovers** (Menu, Tooltip, org/project switcher) use the Popover API (light dismiss, Escape,
  focus return) placed with **CSS anchor positioning** (`useAnchor` + `pop-below`/`pop-above` in
  `popover.css`, logical `position-area` so RTL flips, `position-try-fallbacks` for 360 px).
- **Dialog** replaces Sheet: one native `<dialog>` with `placement` sheet | center.
- **React Aria** is loaded only on interaction: "Custom" range opens the date field, "Add filter"
  opens the combobox. Measured with en-US strings only (`@react-aria/optimize-locales-plugin`; RAC
  has no `fa` strings, so fa falls back to en-US for its few built-in labels): date field 31.6 KB +
  shared core 31.5 KB gz, combobox 23.8 KB + the same core. That is over ADR 0004's 40 KB trigger,
  but no route pays it on load (initial JS stays 103.6 KB gz). The trigger becomes: replace a widget
  with a hand-built one if its chunk lands on the initial or report-load path, or exceeds 80 KB gz.
- **Custom range** is `?from=YYYY-MM-DD&to=YYYY-MM-DD` (local days, Gregorian ISO even when picked
  in the Persian calendar); it wins over `?range=` when valid (real days, in order, not future,
  ≤ 366 days like the API). The field keeps a draft and writes the URL on blur, Enter or calendar
  close: React Aria reports every keystroke that forms a valid date (year 2 on the way to 2026).
- **Recharts** stays a lazy chunk (105 KB gz) behind TimeSeriesChart, which always offers the table.
- **Primitives take labels as props** (no `t()` in `shared/ui`); wrappers in `shared/components`
  translate. ConsentBanner belongs to the example app, not the dashboard.
- **Browser tests**: a second Vitest project runs `test/*.browser.tsx` in the installed Chrome with
  our CSS (`@vitest/browser-playwright`), for keyboard, top-layer, RTL and 360 px checks.

## Consequences
The browser tests found three real defects jsdom could not: `text-body` on `<html>` made 1rem 14 px
(44 px targets were 38.5 px), visually hidden radios widened the page to 528 px at 360, and React
Aria's 12 px edge padding pushed a full-width combobox list off screen, so the page scrolled and RAC
closed the list. CSS anchor positioning needs a current browser (support matrix checked in the 5f
a11y pass); without it a popover falls back to its default top-layer position. Revisit the RAC
choice if a chunk crosses the new trigger, or if RAC gains `fa` strings (then add `fa-IR`).
