// Nightly logical backup (spec §14.2), Linux or Windows: `pg_dump -Fc` of the didban database,
// verified, kept BACKUP_KEEP_DAYS days. Linux: the `postgres` user from didban-backup.timer (peer
// auth). Windows: Task Scheduler runs `node --env-file=C:\didban\config\backup.env backup.mjs`
// (PGHOST, PGUSER, PGPASSWORD, PG_BIN). Copy the backup directory off the box as well.
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { capture, log, pg, run } from "./ops/run.mjs";

const win = process.platform === "win32";
const DB = process.env.DIDBAN_DB ?? "didban";
const DIR = process.env.BACKUP_DIR ?? (win ? "C:\\didban\\backups" : "/var/backups/didban");
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS ?? 14);
const say = (message) => log("backup", message);

if (!win) process.umask(0o077);
mkdirSync(DIR, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const file = join(DIR, `${DB}-${stamp}.dump`);
const partial = join(DIR, `.${DB}-${stamp}.dump.partial`);

say(`dump ${DB} -> ${file}`);
try {
  // daily_salts keeps only its schema: salts are destroyed daily (spec §12) and must not outlive
  // that in a backup. A restored instance creates a fresh salt.
  const args = ["--format=custom", "--compress=6", "--exclude-table-data=daily_salts"];
  run(pg("pg_dump"), [...args, `--file=${partial}`, DB]);
  // A dump that pg_restore cannot list is not kept under the final name.
  capture(pg("pg_restore"), ["--list", partial]);
  renameSync(partial, file);
} finally {
  rmSync(partial, { force: true });
}
say(`ok: ${Math.round(statSync(file).size / 1024)} KiB`);

const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
const old = readdirSync(DIR).filter(
  (name) => /^.+-\d{8}T\d{6}Z\.dump$/.test(name) && statSync(join(DIR, name)).mtimeMs < cutoff,
);
for (const name of old) rmSync(join(DIR, name));
say(`retention: removed ${old.length} dump(s) older than ${KEEP_DAYS} days`);
