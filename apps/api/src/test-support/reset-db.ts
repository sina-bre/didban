import postgres from "postgres";
import { requireVar } from "./test-env.js";

/**
 * Empties every data table in the test DB (spec §16: truncate between tests). Runs as the
 * migrator role because the app role is DML-only and may not TRUNCATE.
 */
export async function resetDb(): Promise<void> {
  const sql = postgres(requireVar("TEST_MIGRATION_DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ name: string }[]>`
      SELECT tablename AS name FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`;
    if (tables.length === 0) return;
    await sql`TRUNCATE ${sql(tables.map((table) => table.name))} CASCADE`;
  } finally {
    await sql.end();
  }
}
