## 13. Dashboard and UI template integration

> Addendum override: the template is screenshots, not code. §13.2 is replaced by `docs/spec/22-addendum.md` §A3 and `docs/design-system/README.md`.

### 13.1 Stack
React 19, TypeScript strict, Vite, React Router, TanStack Query (all server state), React Hook Form + Zod (forms, schemas from `packages/contracts`), a date library with IANA time zone support (verify the current maintained option), the template's chart library or Recharts. Local UI state stays local. No global client store without a concrete shared-state need.

**Styling stack is whatever the template uses.** Tailwind is the default only if the template is Tailwind-based. Do not add a second styling system.

### 13.2 Template protocol (mandatory)

1. **Inspect `./ui-template/` first.** Record in `docs/ui-template.md`: framework, language, styling system, component inventory, chart library, icon set, i18n/RTL support, accessibility notes, and **license (check it permits use in this project)**.
2. **Do not install or generate shadcn/ui, add a different component library, or introduce a Radix-based kit.** If the template itself depends on Radix or similar, keep that dependency as-is and add nothing beyond it.
3. Vendor the template's reusable pieces into `apps/dashboard/src/shared/ui/`. Preserve license headers. Modify vendored files only to fix bugs or accessibility defects. Log each modification in `docs/ui-template.md`.
4. Feature code imports UI only through a single barrel (`shared/ui`) and thin domain wrappers in `shared/components`: `StatCard`, `TimeSeriesChart`, `BreakdownTable`, `DateRangePicker`, `FilterBar`, `ProjectSwitcher`, `ChannelBadge`, `EmptyState`, `ErrorState`, `PermissionDenied`, `ConsentBanner` (for the example app only). Swapping the template later must touch `shared/ui` only.
5. **Gap list before building:** compare required widgets to the template inventory (date-range picker, combobox, multi-filter chips, sortable paginated table, toast, modal, tabs, skeleton, copy-to-clipboard code block, two-level organization/project switcher, stepper for the onboarding wizard). Report gaps. Build only the missing ones, in the template's own styling idiom, minimally.
6. If the template is static HTML (Bootstrap-style) or uses jQuery plugins: port to React components and replace plugin behavior with React equivalents. Do not ship jQuery.
7. **Delete all template demo pages, mock data, and sample charts.** Deleting means removed from the repo, not hidden from the router.
8. If a template dependency is incompatible with React 19 or the installed Vite, report the conflict, choose the smallest fix (upgrade, patch, replace the one widget), and record it in an ADR.
9. Make the layout work with logical CSS properties so RTL can be enabled without a rewrite. Locale-aware number/date formatting through one formatter module. Strings go through a minimal message catalog; English only in v1.
10. Self-host every font, icon, and script the template references. Remove any `<link>`/`<script>` pointing at an external host (CDNs, font services). Fail the production build if the output references one.

### 13.3 Routes

`/login`, `/accept-invite/:token`, `/projects` (grouped by the organization switcher), `/projects/new` (onboarding wizard), `/projects/:projectId/{overview,realtime,pages,sources,geo,devices,events,goals,data-health,settings}`, `/projects/:projectId/pages/detail`, `/projects/:projectId/settings/{environments,keys,routes,members,sharing,data,audit}`, `/organizations/:organizationId/settings/{members,security,audit}`, `/settings/{profile,security}`, `/admin/{organizations,users,instance}` (platform admins only; the API enforces it, the UI merely hides it), `/share/:token` (read-only view, same report components, no management UI). A route the user cannot access renders the same "not found" state as a missing one.

### 13.4 Behavior requirements

- Shared filter bar and date range persist in the URL search params. Browser back/forward restores them.
- Visible "comparison off/on" state. Delta badges with correct sign and the null rule from section 4.
- Interval selector constrained to sensible choices for the range.
- Cookieless-mode label for multi-day visitor counts (section 4), and a "Geo not configured" state when applicable.
- Every chart has a data-table fallback and labeled axes. Keyboard-operable range and filter controls.
- Realtime uses `refetchInterval` and pauses when the tab is hidden.
- API client: one module, request cancellation via `AbortSignal`, error normalization to the contract error shape, global 401 → login redirect that preserves the return path.
- Loading skeletons, empty states with the integration snippet link, error states with request ID, 403 state.
- Light/dark themes only if the template provides them; otherwise do not invent a theme system.
- Integration page per environment: shows the real write key, copy-ready snippets (vanilla SDK, Next.js App Router, script tag, server-event `fetch`), the capability table from section 3.4, and a **"waiting for first event" live check** that polls the realtime endpoint. When the check times out, it reads `ingestion_diagnostics` and states the likely cause (for example "events rejected with `ORIGIN_NOT_ALLOWED` from `https://example.com`") with a confirm-button action to add that origin.
- The onboarding wizard (create project → environment → key and snippet → live check) is the default path for a new project and must work end to end without visiting any other page.
- The organization switcher lists only organizations the user belongs to. Project lists are filtered server-side; the UI never receives projects the user cannot access.
