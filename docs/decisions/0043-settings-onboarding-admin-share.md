# 0043 — Settings, onboarding live check, admin pages and the share view

- Status: Accepted
- Date: 2026-10-31

## Context
Stage 5e (spec §13.3, §13.4, §11, addendum A9) needs pages the API could not fully serve: no
member lists, no platform-admin reads, an org-wide audit log only. Spec §3.1 asks for data
deletion by range, visitor and user ID, which §12 defines as a chunked job with a progress record,
and §18 places retention/deletion jobs in Stage 6. The share view must reuse the report
components, but they read `/projects/:id/stats/*` with a session.

## Decision
- **API reads:** `GET /organizations/:id/members` (`org:users`), `GET /projects/:id/members`
  (`project:members`; assigned members plus the org `member`s who could be assigned), `GET
  /admin/{organizations,users,instance}` (`platform`, counts only, no project data), and
  `projectId` on the audit log with `audit_logs_project_idx` (migration 0013). EXPLAIN on 200 000
  entries of one org, 1 in 100 for the project: before, a backward primary-key scan that filters
  4 950 rows (80 buffers, 0.64 ms); after, an index range scan (53 buffers, 0.08 ms).
- **Data page** = retention, PII guard, cities, URL and site-search parameters, archive (org
  owners/admins). Deletion requests wait for the Stage 6 job runner; no form without a backend.
- **Live check:** Realtime per environment every 3 s; after 30 s also Data Health, and the likely
  cause is the newest rejected batch, else the top rejection code, else the top rejected origin.
  `ORIGIN_NOT_ALLOWED` with an origin gets an "Allow …" button (PATCH of the environment).
  An environment change now forgets that environment's entries in the write-key cache (moved to
  the global diagnostics module), so the fix applies to the next event on that process.
- **Share view:** a `StatsSourceContext` swaps the stats URL to `/share/stats/*` with the
  `X-Share-Token` header; Overview, Sources, Geo and Devices render unchanged, CSV export hides.
  The token comes from the fragment (ADR 0036) and is kept in sessionStorage, because range and
  filter links replace the fragment.
- **Navigation:** a "Menu" in the top bar (all projects, project settings, new project, org
  settings, admin); `sections.ts` stays untouched. `/` opens the first project, `/projects` is the
  list. Forms: plain `FormData` + the contract schema (`useSettingsForm`), not React Hook Form,
  to keep the settings chunks small. One-time secrets (key, share URL, temporary password) show in
  a `<dialog>` and are dropped on close.
- Not built: `/settings/{profile,security}` and the org security tab (TOTP is not in v1 yet, A9).

## Consequences
Initial JS 124.2 → 130.8 KB gz (toast provider, menu, route table; budget 180). Other API
processes still see an allowed origin only after their 60 s key cache expires (ADR 0025).
Revisit the live check timing if real installs need longer than 30 s before the first event,
and the deletion page when Stage 6 adds the job runner.
