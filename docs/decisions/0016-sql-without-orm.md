# 0016 — Plain SQL with postgres.js, no ORM (supersedes the Prisma row of spec §2)

- Status: Accepted (owner delegated the choice, 2026-10-17)
- Date: 2026-10-17

## Context
Spec §2 chose Prisma for metadata CRUD and raw SQL for everything else. In practice most of the hard parts
are raw SQL anyway: stats queries, bulk inserts with `ON CONFLICT`, advisory locks, visit upserts, CHECK
constraints and partial indexes (hand-written migrations). Prisma 7 adds a codegen step, `prisma.config.ts`,
a driver adapter and a large dependency, plus a second way to migrate that we would work around.
The owner wants the simplest, fastest, most maintainable option.

## Decision
- Driver: **`postgres` (postgres.js) 3.4.9**, Unlicense (public domain), zero dependencies. Queries are
  tagged templates (`sql\`… ${value}\``), so values are always bound parameters; identifiers only via
  allowlists + `sql(identifier)`.
- One pool per process (`DB_POOL_MAX`), `postgres.camel` transform (snake_case columns → camelCase fields).
- Migrations: plain `.sql` files in `apps/api/migrations/NNNN_name.sql`, applied in order by a ~60-line runner
  (`src/db/migrate.ts`) under an advisory lock, each in a transaction (opt out with a first line
  `-- migrate:no-transaction`), with a SHA-256 checksum so an edited, already-applied migration fails loudly.
  Only the migrator role runs them (spec §9.5); never on API start-up.
- Row types are written by hand next to the repository that reads them. Integration tests against real
  PostgreSQL catch drift (spec §16 already requires them).

## Consequences
- One way to talk to the database: SQL. No generated client to keep in sync, no ORM query surprises.
- No schema-diffing: every change is a new forward-only SQL file (expand/contract, spec §14.2).
- Prisma skills were removed from `.claude/skills`; `supabase-postgres-best-practices` covers SQL work.
- Revisit only if hand-written row types cause repeated bugs; the candidate then is Kysely (typed builder),
  not a full ORM.
