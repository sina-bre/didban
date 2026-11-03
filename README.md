# Didban

Didban (دیدبان, "observer"): self-hosted, privacy-friendly web analytics. A browser SDK
(`@didban/analytics`, `@didban/react`) sends events to a NestJS ingestion API that writes them to
PostgreSQL; a React dashboard (English and Persian, RTL) reads them through the analytics API.
Cookieless by default. No containers, no third-party services. License: MIT.

## Run it locally
Prerequisites: Node 24 (`.nvmrc`), pnpm 11 (`corepack enable`), PostgreSQL 16+ (18 tested) running
on localhost with its superuser password at hand. Windows, Linux and macOS.
```bash
pnpm install
pnpm db:setup
pnpm db:migrate
pnpm build
pnpm cli create-owner
pnpm dev
```
`db:setup` creates the dev and test databases and the two roles (`analytics_migrator` for DDL,
`analytics_app` for DML) and writes their URLs into `.env` (copied from `.env.example`).
`create-owner` asks for an email and an organization name and prints a temporary password. Open
http://localhost:5173, sign in, set your own password, then create a project in the wizard; it
shows the write key and the snippet. API: http://127.0.0.1:5100 (`/api/v1/health/ready`).

Checks: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` (after `pnpm build`;
first run `pnpm -C e2e exec playwright install chromium`) · `pnpm check:packages` · `pnpm load`.

## Documentation
- Using it: [integration](docs/integration.md) · [SDK](docs/sdk.md) · [metrics](docs/metrics.md) ·
  [HTTP API](docs/api.md) · [privacy](docs/privacy.md)
- Running it: [deployment](docs/deployment.md) · [operations](docs/operations.md) ·
  [security](docs/security.md) · [tenancy](docs/tenancy.md) · [known limitations](docs/known-limitations.md)
- Inside: [architecture](docs/architecture.md) · [database](docs/database.md) ·
  [load baseline](docs/load-baseline.md) · [dashboard performance](docs/dashboard-performance.md) ·
  [decisions](docs/decisions/) · [licenses](docs/licenses.md) · [releasing](docs/releasing.md)
- Spec and plan: [`docs/spec/`](docs/spec/README.md), [`docs/plan/`](docs/plan/progress.md),
  [design system](docs/design-system/README.md). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md).

## AI tooling
Agent guide: [`CLAUDE.md`](CLAUDE.md); project skills in `.claude/skills/` (pinned in
`skills-lock.json`, restore with `npx skills experimental_install`). MCP servers are in `.mcp.json`;
on macOS/Linux replace `"command": "cmd", "args": ["/c", "npx", …]` with `"command": "npx"`.
The `postgres` server needs `uv` and `ANALYTICS_DEV_DATABASE_URL`.
