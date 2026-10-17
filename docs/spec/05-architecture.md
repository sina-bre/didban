## 5. Architecture

### 5.1 Modules (NestJS)

`auth`, `users`, `organizations`, `memberships`, `projects`, `environments`, `api-keys`, `goals`, `share-links`, `ingestion`, `events`, `analytics`, `exports`, `jobs`, `audit`, `health`.

Responsibilities that must not blur:
- `ingestion`: HTTP, auth by write key, validation, enrichment, orchestration. **Depends on `events` (write side). Never imports `analytics`.**
- `events`: persistence only: bulk writer, visit upserts, dedupe, retention, deletion.
- `analytics`: read-only SQL queries and aggregation rules. Never writes events.
- `jobs`: schedule and lock only; the work lives in the owning module.

### 5.2 Dependency direction

Controller → application service/use case → domain rules + repository interface → Prisma/SQL implementation.

- Controllers contain no business logic and no queries.
- Domain code does not import NestJS, Prisma, or HTTP types.
- Repository interfaces exist only at real boundaries: `EventWriter`, `AnalyticsReader`, `ProjectRepository`, `ApiKeyRepository`, `AuthSessionRepository`. No `BaseRepository<T>`. No CQRS, no mediator, no event sourcing.
- Straight CRUD modules (`goals`, `share-links`) use a plain service. Do not add layers that carry no logic.

### 5.3 Monorepo layout

```text
analytics/
├── apps/
│   ├── api/            # NestJS
│   └── dashboard/      # React SPA (vendored template in src/shared/ui)
├── packages/
│   ├── contracts/      # Zod schemas, inferred types, error codes, limits constants
│   └── sdk/            # browser SDK (framework-independent)
├── examples/
│   ├── vanilla-vite/   # real integration example (SDK via workspace link)
│   └── script-tag/     # static HTML using the IIFE build
├── tools/load/         # k6 or autocannon scripts + README with methodology
├── scripts/            # dev-db.sh, deploy.sh, backup.sh, restore-check.sh, create-owner (CLI)
├── deploy/             # systemd units, Caddyfile, nginx sample, logrotate, env template
├── data/               # sources.json, channels.json, search/social host lists
├── docs/
├── .env.example
├── .nvmrc
└── pnpm-workspace.yaml
```

`packages/contracts` contains schemas and constants only. No framework imports, no React, no Prisma.
