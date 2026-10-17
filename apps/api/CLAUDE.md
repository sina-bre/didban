# apps/api — NestJS rules

Spec: `docs/spec/05`, `06`, `07`, `09`, `10`, `11`. Skills: `nestjs-best-practices`,
`supabase-postgres-best-practices`. Database access: plain SQL via postgres.js (ADR 0016).

## Shape of a module (copy this, do not invent layers)
```
src/modules/projects/
  projects.module.ts        wiring only
  projects.controller.ts    HTTP in/out, permission decorator, no logic, no queries
  create-project.ts         one use case = one file (plain class or function)
  archive-project.ts
  project.repository.ts     only for the boundaries in spec §5.2
  projects.schema.ts        re-exports Zod schemas from @didban/contracts
  projects.test.ts
```
- Domain rules (`src/domain/*`) import nothing from NestJS, postgres.js or HTTP.
- `ingestion` depends on `events`; never on `analytics`. `analytics` never writes.
- Every tenant query takes an `AccessScope`. No repository method takes a bare project ID.
- Every route declares a permission decorator or is on the public allowlist (route-coverage test).
- Validation: Zod schemas from `packages/contracts` through one pipe. No class-validator, no DTO classes.

## Performance and SQL
- All SQL is postgres.js tagged templates (`sql`...${value}...``): values are always bound.
  Identifiers only from allowlists via `sql(name)`. Never `sql.unsafe` with user input.
- Schema changes: new file `migrations/NNNN_name.sql`, never edit an applied one. `pnpm db:migrate`.
- Bulk writes: multi-row `INSERT ... ON CONFLICT` in chunks of 500 (`sql(rows, columns)`); one transaction per ingest request; never one INSERT per event.
- Any new index needs an `EXPLAIN (ANALYZE, BUFFERS)` before/after in the PR or ADR.
- No caches, queues, Redis or partitions until a trigger in spec §20 is measured.

## Tests
Vitest + SWC transform, real PostgreSQL test DB (truncate between tests). No SQLite, no DB mocks
in repository/integration tests.
