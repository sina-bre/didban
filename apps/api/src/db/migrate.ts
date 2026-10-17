import postgres from "postgres";
import { type MigrationFile, readMigrations } from "./migration-files.js";

// Any constant works; it only has to be the same for every runner so two deploys never overlap.
const MIGRATION_LOCK = 727_001;

type Tx = postgres.Sql | postgres.TransactionSql;

async function apply(sql: postgres.Sql, migration: MigrationFile): Promise<void> {
  const record = (tx: Tx) =>
    tx`INSERT INTO schema_migrations (version, checksum)
       VALUES (${migration.version}, ${migration.checksum})`;
  if (!migration.transactional) {
    await sql.unsafe(migration.sql);
    await record(sql);
    return;
  }
  await sql.begin(async (tx) => {
    await tx.unsafe(migration.sql);
    await record(tx);
  });
}

/**
 * Applies pending migrations from `dir` (ADR 0016). Run with the migrator role only.
 * Returns the versions applied in this run.
 */
export async function migrate(url: string, dir: string, log = console.log): Promise<string[]> {
  // max: 1 keeps the advisory lock and every statement on the same session.
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK})`;
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const rows = await sql<{ version: string; checksum: string }[]>`
      SELECT version, checksum FROM schema_migrations`;
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));

    const done: string[] = [];
    for (const migration of readMigrations(dir)) {
      const checksum = applied.get(migration.version);
      if (checksum && checksum !== migration.checksum) {
        throw new Error(`${migration.version} changed after it was applied; add a new migration`);
      }
      if (checksum) continue;
      await apply(sql, migration);
      done.push(migration.version);
      log(`applied ${migration.version}`);
    }
    return done;
  } finally {
    await sql.end({ timeout: 5 }); // closing the session releases the advisory lock
  }
}
