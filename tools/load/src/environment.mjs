// Spec §16: every result records hardware, PostgreSQL settings, pool size, batch size, duration.
import os from "node:os";

const PG_SETTINGS = [
  "server_version",
  "max_connections",
  "shared_buffers",
  "work_mem",
  "synchronous_commit",
  "wal_level",
  "fsync",
];

export async function describeEnvironment(sql) {
  const rows =
    await sql`SELECT name, setting, unit FROM pg_settings WHERE name IN ${sql(PG_SETTINGS)}`;
  const postgres = Object.fromEntries(
    rows.map((r) => [r.name, r.unit ? `${r.setting} ${r.unit}` : r.setting]),
  );
  return {
    cpu: `${os.cpus()[0]?.model.trim()} (${os.cpus().length} logical)`,
    memoryGb: Math.round(os.totalmem() / 2 ** 30),
    os: `${os.type()} ${os.release()}`,
    node: process.version,
    postgres,
    note: "client (autocannon), API and PostgreSQL share this machine",
  };
}

/** Only a local database: the load test writes lots of rows. */
export function localDatabaseUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run \`pnpm db:setup\`.`);
  const host = new URL(value).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error(`Refusing: ${name} points at ${host}, the load test runs only on localhost.`);
  }
  return value;
}
