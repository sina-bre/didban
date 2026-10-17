// `pnpm db:setup`: creates local dev/test databases and the two roles (spec §9.5). Idempotent.
// Asks once for the PostgreSQL superuser password. Refuses any host other than localhost.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promptHidden } from "./prompt-hidden.mjs";

const host = process.env.PGHOST ?? "localhost";
const port = process.env.PGPORT ?? "5432";
const user = process.env.PGUSER ?? "postgres";
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing: db:setup only runs against localhost (PGHOST=${host}).`);
  process.exit(1);
}

const run = (cmd, args, env = process.env) =>
  spawnSync(cmd, args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "inherit"] });
const getEnv = (key) => run(process.execPath, ["scripts/set-env.mjs", "--get", key]).stdout;
const secret = () => randomBytes(18).toString("base64url");

const password =
  process.env.PGPASSWORD ?? (await promptHidden(`Password for PostgreSQL superuser '${user}': `));
const pgEnv = { ...process.env, PGHOST: host, PGPORT: port, PGUSER: user, PGPASSWORD: password };
const appPw = getEnv("DEV_DB_APP_PASSWORD") || secret();
const migratorPw = getEnv("DEV_DB_MIGRATOR_PASSWORD") || secret();

function psql(database, file, vars = []) {
  const args = ["-X", "-q", "-d", database, ...vars.flatMap((v) => ["-v", v]), "-f", file];
  const result = run("psql", args, pgEnv);
  if (result.error) throw new Error(`psql not found on PATH (${result.error.message})`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

psql("postgres", "scripts/sql/dev-db-roles.sql", [`app_pw=${appPw}`, `migrator_pw=${migratorPw}`]);
for (const db of ["didban_dev", "didban_test", "didban_shadow"]) {
  psql(db, "scripts/sql/dev-db-grants.sql");
}

const base = `${host}:${port}`;
const url = (role, pw, db) => `postgresql://${role}:${pw}@${base}/${db}`;
run(process.execPath, [
  "scripts/set-env.mjs",
  `DEV_DB_APP_PASSWORD=${appPw}`,
  `DEV_DB_MIGRATOR_PASSWORD=${migratorPw}`,
  `DATABASE_URL=${url("analytics_app", appPw, "didban_dev")}`,
  `MIGRATION_DATABASE_URL=${url("analytics_migrator", migratorPw, "didban_dev")}`,
  `SHADOW_DATABASE_URL=${url("analytics_migrator", migratorPw, "didban_shadow")}`,
  `TEST_DATABASE_URL=${url("analytics_app", appPw, "didban_test")}`,
  `TEST_MIGRATION_DATABASE_URL=${url("analytics_migrator", migratorPw, "didban_test")}`,
  `ANALYTICS_DEV_DATABASE_URL=${url("analytics_app", appPw, "didban_dev")}`,
]);

console.log(
  "Done: roles analytics_migrator/analytics_app, databases didban_dev/didban_test/didban_shadow.",
);
console.log("Connection strings written to .env (git-ignored).");
