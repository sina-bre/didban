## 2. Locked decisions

| Area | Decision |
|---|---|
| Topology | Modular monolith: one NestJS app, one React SPA, one SDK package. **One central instance serves all tracked sites**: one backend, one database, many isolated projects. It runs on its own hostname (`analytics.<operator-domain>`), never on a subpath of a tracked site. The reverse proxy serves the SPA at `/` and proxies `/api` to the API, so **dashboard and API are same-origin**. Tracked sites are cross-origin to the collector (CORS-simple requests, section 6) or reach it through their own same-origin proxy path (section 8.4). See section 14.0. |
| Containers | **None.** No Dockerfile, Compose file, devcontainer, or container-based docs. (Only exception: if a CI workflow is added, GitHub Actions `services: postgres` is allowed. Nothing container-related ships in the repo.) |
| Database | PostgreSQL 16+. Native install, no extension requirements (no TimescaleDB, no `pg_partman`, no `postgres-hll`). |
| ORM | Prisma for metadata CRUD and bulk insert. `$queryRaw` with `Prisma.sql` for analytics. Hand-written SQL migrations for anything Prisma cannot express (partial indexes, CHECK constraints, partitions). |
| Validation | Zod, defined once in `packages/contracts`. HTTP DTO types, SDK types, and dashboard types are inferred from it. No hand-duplicated DTO classes. OpenAPI generated from the Zod schemas. |
| Auth | Email + password (Argon2id), server-side sessions in PostgreSQL, opaque tokens, HttpOnly cookie, optional TOTP. **No JWT, no OAuth, no refresh tokens, no public signup.** |
| Background jobs | In-process scheduler guarded by `pg_try_advisory_lock`. No Redis, no BullMQ. |
| Rate limiting | In-memory per process in v1. Redis only on the trigger in section 20. |
| UI | **Vendored UI template supplied by the human. No shadcn/ui. No Radix wrapper libraries added by you.** See section 13. |
| Charts | The template's chart library if it ships one; otherwise Recharts. |
| Tooling | pnpm workspaces, Node active LTS (pinned in `.nvmrc` + `engines`), Vitest for unit/integration, Playwright for E2E, Pino for logs. |
| Hosting target | One Linux VPS (Ubuntu LTS): systemd + Caddy (Nginx sample provided) + native PostgreSQL. |
| Tenancy | **Multi-organization from day one.** Organizations are customers/teams. Isolation is enforced server-side on every route. Resources the caller cannot access return `404`, not `403` (section 11). A platform-admin flag exists for the instance operator. |
| Runtime third-party dependencies | None. No CDN-hosted scripts or fonts, no external error trackers, no telemetry calls home. Fonts and icons are self-hosted. The dashboard must load and work when every host except the operator's own is unreachable. |
