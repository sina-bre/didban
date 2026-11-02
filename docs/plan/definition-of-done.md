# Definition of Done: final check (Stage 6d, 2026-11-02)

Every item of [`docs/spec/19`](../spec/19-definition-of-done.md), checked on branch
`claude/practical-babbage-620d3e` (Stage 6a–6d, unmerged). The "Final report must contain" part is
[final-report.md](final-report.md). Command output: [dod-evidence.md](dod-evidence.md).
Verdict: **9 of 11 met, 2 partly met** (items 3 and 10); nothing is published or pushed.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Clean machine runs it from `README.md` | **Met on this box, not on a clean one** | README rewritten in 6d (it still said "Phase 0, no code"). Steps run here: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm dev` → API `/ready` 200, dashboard 200, proxy 200. Found and fixed: API watch needed `chokidar`. `db:setup` + `create-owner` ran in earlier stages, not from scratch today; no fresh machine or VM was used for the dev setup. |
| 2 | Migrations on an empty DB; app role cannot run DDL | **Met** | `db.test.ts` "refuses DDL for the app role", migrations idempotent + edit-detection; 15 migrations applied from empty on the WSL Ubuntu box by the migrator role (deployment validation record). |
| 3 | Two orgs with separate owners; log in, **enable TOTP**, create a user (A9), assign project access, project + environment via the wizard, write key | **Partly met: no TOTP** | E2E `dashboard-settings.spec.ts`: platform admin creates an organization and its owner; owner creates a user who must set a password; onboarding wizard project → environment → key → live check. `access-roles.test.ts`: assign project access. **TOTP is not built** (A9: before the first public release). |
| 4 | Vanilla + Next.js examples: page view and custom event persisted; server event with `$revenue`/`$currency` via `write_server` | **Met** | E2E `vanilla.spec.ts`, `nextjs.spec.ts`, `script-tag.spec.ts` against the real API; `server-event.spec.ts` "server event with revenue lands once, retry counts as duplicate". |
| 5 | Dashboard via real queries: cookieless/persistent, filters, comparison, goals with revenue, realtime, discovered pages + route grouping, data health, export; wrong origin → `ORIGIN_NOT_ALLOWED` with the origin | **Met** | E2E `dashboard-trace.spec.ts` (KPIs, pages, sources equal SQL on stored rows), `dashboard-reports.spec.ts` (filters, export, goals, data health), `dashboard-range.spec.ts` (comparison), `dashboard-insights.spec.ts` (realtime), onboarding live check names the cause and the origin. API suites cover persistent identity, route templates, revenue goals. |
| 6 | Owner B gets 404 on every route of A; members see assigned projects only; non-member platform admin sees no analytics; write keys read nothing | **Met** | `isolation.test.ts` (all four), `scoped-lists.test.ts`; E2E "another organization's or a made-up project looks like a missing page". |
| 7 | Invalid, oversized, future, stale payloads, rate limits, quota, mid-batch DB failure | **Met** | 6c load run (abusive/oversized/hostile: 400/401/403/413/429 as specified) in [load-baseline](../load-baseline.md); `ingestion-limits.test.ts` (quota, future, stale), `event-writer.test.ts` (mid-batch failure rolls back), `ingest-unavailable.test.ts` (503 causes). |
| 8 | SDK standalone, `publint`/`attw`, size budget, installs from a packed tarball | **Met** | `pnpm check:packages` (publint --strict, attw esm-only, tarballs into an empty project, smoke run) and size-limit in `pnpm build`: core 4.99/5 kB, script tag 6.06/6.5 kB, modules ≤ 518 B, React 240 B. Plus `pnpm release:dry-run`. |
| 9 | Lint, typecheck, unit, integration, E2E pass; production builds (output attached) | **Met** | [dod-evidence.md](dod-evidence.md): all five in order, real output, reruns noted. |
| 10 | systemd + Caddy deployment, rolling restart, graceful shutdown, backup + restore check documented **and executed** | **Partly met** | Linux: all executed 2026-11-01 on Ubuntu 24.04 (WSL2), [validation record](../deployment.md#validation-record). Windows: deploy, backup, restore-check executed; **WinSW services, Caddy service and scheduled backup not installed** (no admin). Not on a real server, no ACME certificate. |
| 11 | Docs match the implementation; known limitations listed | **Met** | 6d audit: added the missing spec §17 files (`api`, `architecture`, `security`, `tenancy`, `privacy`, `licenses`), [known-limitations](../known-limitations.md), [releasing](../releasing.md); fixed README, CLAUDE.md commands. `operations.md` metric names match `/metrics`; `.env.example` matches `config/env.ts`. Gaps stated, not hidden: no OpenAPI (spec §2), `ui-template.md` not applicable (A3: screenshots, no template). |

## Unmet or partly met, in one list
1. TOTP (DoD 3, A9). 2. Windows services never installed (DoD 10). 3. No clean-machine run of
the README (DoD 1). 4. OpenAPI not generated (spec §2, affects §17 `api.md`). 5. No CI: spec §12
"fail CI on high/critical advisories" and A7 secret scan run nowhere automatically. 6. Load
budgets broken on the busy dev box, Linux never load-tested. 7. 90-day stats at 10 M events time
out. 8. npm trusted publishing untested. Details and owners' actions: [known-limitations](../known-limitations.md).
