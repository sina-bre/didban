# Didban — agent guide

Self-hosted web analytics (Umami/Plausible-class): browser SDK → NestJS ingestion → PostgreSQL →
analytics API → React dashboard. pnpm monorepo, no containers.

## Start every session here
1. Read `docs/plan/progress.md` (current stage, what is done, what is next). Do not re-derive it.
2. Open only the spec files the task needs: `docs/spec/README.md` maps tasks → files.
3. Area rules live in nested `CLAUDE.md` files (`apps/api`, `apps/dashboard`, `packages/sdk`).
4. Finish every session by updating `docs/plan/progress.md` (≤ 10 lines per entry).

## Non-negotiables
- **Small and simple.** Files ≤ 100 lines (hard fail at 150), functions ≤ 40 lines. Split by use case.
  No abstraction without a second caller. No `utils.ts` grab-bags. (`docs/spec/22-addendum.md` A1)
- **Never trust remembered APIs.** Versions here are newer than your training data (NestJS 12 ESM, Zod 4,
  Vite 8, React Router 8, Vitest 5, NestJS 12, Tailwind 4). Check installed types or use the
  `context7` MCP before writing config or API calls.
- **Never claim a check passed without running it.** Paste the real output.
- No mocks, fake data, `TODO` stubs or placeholder services in shipped code.
- Stage order from `docs/plan/phases.md`. The app builds and starts after every stage.
- Decisions go in `docs/decisions/NNNN-*.md` (copy `0000-template.md`). Docs describe what exists.
- Do not publish to npm, push, or use real credentials without explicit owner approval.

## Precedence when instructions conflict
spec addendum (`docs/spec/22`) > spec (`docs/spec/00–21`) > ADRs > this file > skills.
Skills are advice. Example: `baseline-ui` says "use Radix/Base UI", but the spec bans Radix kits,
so the spec wins (see ADR 0004).

## Skills: when to load
| Task | Skill |
|---|---|
| Any Postgres schema, migration, index, slow query | `supabase-postgres-best-practices` |
| SQL access (postgres.js, no ORM: ADR 0016) | `supabase-postgres-best-practices` |
| NestJS modules, guards, DI | `nestjs-best-practices` (keep it to our flat structure) |
| Tests | `vitest`; E2E/browser checks: `webapp-testing` + `playwright` MCP |
| React components, bundle, perf | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Server state | `tanstack-query-best-practices` |
| Visual design, tokens, layout | `ui-ux-pro-max`, `frontend-design` + `docs/design-system/README.md` |
| UI polish / review | `baseline-ui`, `web-design-guidelines`, `fixing-accessibility`, `fixing-motion-performance` |
| Need a capability we lack | `find-skills` |

## MCP servers (`.mcp.json`)
- `context7`: current library docs. Use it instead of guessing APIs.
- `playwright`: drive the dashboard and example apps in a real browser.
- `postgres`: read-only (`restricted`) access to the **dev** DB for `EXPLAIN`, index and health checks.
  Needs `ANALYTICS_DEV_DATABASE_URL` set. Never point it at production.

## Token hygiene
- Read files with `offset/limit` when you know the region. Use Grep before Read.
- Never browse `node_modules`; grep the one `.d.ts` you need. `dist`, lockfiles, skill data are denied.
- `ui-ux-pro-max`: run its search script; do not open its CSV data.
- One stage (or sub-stage) per session. `/compact` at sub-stage boundaries.

## Commands (exist from Stage 1)
`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm build` ·
`pnpm db:migrate` · `pnpm db:seed` · `pnpm cli <cmd>` · `pnpm load` · `pnpm check:packages`

## Environment facts
Windows 10 dev box, Git Bash. Node 24 LTS, pnpm 11, PostgreSQL 18 native (spec minimum 16).
Production target: Ubuntu LTS + systemd + Caddy.
