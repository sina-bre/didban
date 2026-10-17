# apps/dashboard — React SPA rules

Spec: `docs/spec/13`, `22` (A3–A6). Design: `docs/design-system/README.md` (tokens, components, layouts).
Skills: `ui-ux-pro-max`, `frontend-design`, `vercel-react-best-practices`,
`tanstack-query-best-practices`, then review with `baseline-ui` and `fixing-accessibility`.

## Structure
```
src/
  app/            router, providers, layout shells (desktop top-nav, mobile bottom-bar)
  shared/ui/      our primitives (Button, Card, Segmented, Tooltip, Dialog...) — only place for raw styling
  shared/components/  domain wrappers: StatCard, TimeSeriesChart, BreakdownTable, FilterBar...
  shared/lib/     api-client.ts, format.ts (Intl), i18n.ts (t()), url-state.ts
  features/<name>/    page.tsx + use-<name>.ts (query hook) + small parts
  messages/       en.ts, fa.ts (typed catalogs, lazy-loaded)
```
- Feature code imports UI only from `shared/ui` and `shared/components`.
- Components ≤ 100 lines, one per file. Data fetching only in `use-*.ts` hooks (TanStack Query).
- No global store. URL search params hold filters/date range.

## Styling
- Tailwind 4 with tokens from `shared/ui/tokens.css`. No raw hex, no arbitrary values outside tokens.
- **Logical properties only** (`ms/me/ps/pe/start/end/text-start`). `ml-`, `mr-`, `left-`, `right-`,
  `text-left`, `text-right` are banned (lint).
- Numbers: `tabular-nums`, formatted through `shared/lib/format.ts` only.
- Mobile first: build at 360 px, then `md`, `lg`. Touch targets ≥ 44 px. `dvh`, not `vh`.
- No shadcn/ui, no Radix kits. Accessible primitives per ADR 0004.
- Charts: Recharts, lazy-loaded, each with a data-table fallback.
- No external URLs in `index.html` or CSS (build check fails otherwise).

## Dev ports (ADR 0021)
Vite on **5173** with `strictPort: true`; proxy `/api` → `http://127.0.0.1:5100` (the API) so the
dashboard and API stay same-origin (spec §11 CSRF rule). PostgreSQL is 5432.
