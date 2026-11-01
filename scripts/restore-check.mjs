// Monthly restore check (spec §14.2), Linux or Windows: restore a dump (default: the newest) into
// a scratch database, compare counts with the live one, remove the scratch copy. Record the date
// and result in docs/deployment.md.
//   Linux:   sudo -u postgres node scripts/restore-check.mjs [dump]
//   Windows: node --env-file=C:\didban\config\backup.env scripts\restore-check.mjs [dump]
// The scratch database is created and dropped (needs CREATEDB), or DIDBAN_SCRATCH_DB names an
// existing empty database the role owns: its `public` schema is emptied before and after.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { capture, log, pg, run } from "./ops/run.mjs";

const win = process.platform === "win32";
const DB = process.env.DIDBAN_DB ?? "didban";
const DIR = process.env.BACKUP_DIR ?? (win ? "C:\\didban\\backups" : "/var/backups/didban");
const OWN = process.env.DIDBAN_SCRATCH_DB;
const TABLES = ["schema_migrations", "organizations", "users", "projects", "environments"];
TABLES.push("visits", "events", "job_runs", "daily_salts"); // daily_salts: restored empty
const say = (message) => log("restore-check", message);

const newest = () => {
  const dumps = readdirSync(DIR).filter((n) => /^.+-\d{8}T\d{6}Z\.dump$/.test(n));
  return dumps.length ? join(DIR, dumps.sort().at(-1)) : null;
};
const dump = process.argv[2] ?? newest();
if (!dump) throw new Error(`no dump in ${DIR}`);
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const scratch = OWN ?? `${DB}_restore_check_${stamp}`;
const sql = (db, text) =>
  capture(pg("psql"), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", text]);
const count = (db, table) => {
  try {
    return sql(db, `SELECT count(*) FROM ${table}`);
  } catch {
    return "-";
  }
};
const emptySchema = () =>
  sql(scratch, "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public");
const cleanup = () => (OWN ? emptySchema() : run(pg("dropdb"), ["--if-exists", scratch]));

say(`restore ${dump} into ${scratch}`);
if (OWN) emptySchema();
else run(pg("createdb"), [scratch]);
try {
  const started = Date.now();
  // Owners and grants are not needed to check the data; the roles may not exist on this host.
  const args = ["--no-owner", "--no-acl", "--exit-on-error", "--jobs=2", `--dbname=${scratch}`];
  run(pg("pg_restore"), [...args, dump]);
  say(`restored in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(`${"table".padEnd(18)}${"restored".padStart(14)}${"live".padStart(14)}`);
  for (const table of TABLES) {
    const restored = count(scratch, table);
    if (restored === "-") throw new Error(`table ${table} missing from the dump`);
    console.log(`${table.padEnd(18)}${restored.padStart(14)}${count(DB, table).padStart(14)}`);
  }
  if (Number(count(scratch, "schema_migrations")) === 0) throw new Error("no migrations in dump");
  // The newest event must be readable through the time index, not only counted.
  const latest = sql(scratch, "SELECT coalesce(max(occurred_at)::text, 'none') FROM events");
  say(`newest event in the dump: ${latest}`);
  say(`OK ${new Date().toISOString().slice(0, 10)}: ${dump} restores; counts above`);
} finally {
  cleanup();
}
