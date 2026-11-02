// `pnpm -C tools/load vacuum:check [days]` (Stage 6c, ADR 0050): does autovacuum clean `events`
// after a retention-sized delete? On the `seed:large` dataset: vacuum, time the job's min() probe,
// delete the oldest `days` days (default 12 of 90 ≈ 13 %, below the default 20 % threshold), time
// it again, wait for autovacuum with the table's current settings, then with migration 0015's.
// DESTROYS the deleted slice. Runs as the migrator (ALTER TABLE needs the owner).
import postgres from "postgres";
import { localDatabaseUrl } from "./environment.mjs";

const days = Number(process.argv[2] ?? 12);
const WAIT_MS = Number(process.env.VACUUM_WAIT_MS ?? 240_000);
const sql = postgres(localDatabaseUrl("TEST_MIGRATION_DATABASE_URL"), {
  max: 1,
  onnotice: () => {},
  connection: { statement_timeout: "0" },
});
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

const [target] = await sql`
  SELECT project_id AS p, environment_id AS e, min(occurred_at) AS oldest FROM events
  GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT 1`;

/** The job's probe (event-span.ts): ms and shared buffers touched. */
async function probe(label) {
  const plan = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT min(occurred_at) FROM events WHERE project_id = ${target.p} AND environment_id = ${target.e}`;
  const root = plan[0]["QUERY PLAN"][0];
  const buffers = root.Plan["Shared Hit Blocks"] + root.Plan["Shared Read Blocks"];
  log(`${label}: ${root["Execution Time"].toFixed(1)} ms, ${buffers} buffers`);
}

async function tableState(label) {
  const [row] = await sql`
    SELECT n_live_tup, n_dead_tup, last_autovacuum, autovacuum_count,
           (SELECT reloptions FROM pg_class WHERE relname = 'events') AS options
    FROM pg_stat_user_tables WHERE relname = 'events'`;
  log(label, JSON.stringify(row));
  return row;
}

async function waitForAutovacuum(label) {
  const before = Number((await tableState(`${label} start`)).autovacuum_count);
  const end = Date.now() + WAIT_MS;
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const [row] =
      await sql`SELECT autovacuum_count FROM pg_stat_user_tables WHERE relname = 'events'`;
    if (Number(row.autovacuum_count) > before) break;
  }
  await tableState(`${label} end`);
  await probe(`${label}: probe`);
}

await sql`ALTER TABLE events RESET (autovacuum_vacuum_scale_factor,
  autovacuum_vacuum_insert_scale_factor, autovacuum_analyze_scale_factor)`;
await sql`VACUUM (ANALYZE) events`;
await probe("vacuumed");
const cutoff = new Date(target.oldest.getTime() + days * 86_400_000);
const deleted = await sql`
  DELETE FROM events WHERE project_id = ${target.p} AND occurred_at < ${cutoff}`;
log(`deleted ${deleted.count} events older than ${cutoff.toISOString()}`);
await probe("after delete");
await waitForAutovacuum("defaults (20 %)");
await sql`ALTER TABLE events SET (autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`;
await waitForAutovacuum("migration 0015 (2 %)");
await sql.end();
