# 0003 — Dashboard design comes from screenshots, not a code template

- Status: Accepted (owner confirmed use as style reference, 2026-10-17)
- Date: 2026-10-17

## Context
Spec §0/§13 expects `./ui-template/` with code and a license. The owner supplied seven images
(`design/reference/01–07.webp`): a dashboard concept ("MoonRow", desktop + mobile). There is no code to vendor,
no component inventory and no license file.

## Decision
Treat the images as a **visual reference**. The design system lives in `docs/design-system/`. We build our own
small primitives in `apps/dashboard/src/shared/ui/` with Tailwind 4. We do not copy the brand name, the mascot
illustrations, or the logos. This decision unblocks Stage 5.

## Consequences
- We own every component, so a11y and RTL are on us (ADR 0004, 0005).
- **Owner must confirm** the screenshots may be used as inspiration. Borrowing a visual style is normally fine;
  copying assets is not.
- The reference has no dark mode, so v1 ships light only (spec §13.4).
