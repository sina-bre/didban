// Test-only: empties the local test DB and seeds one org with a project per example app
// (environment allowing its origin, localhost tracking on) and the keys from E2E_SEED.
// Runs as the migrator role, like apps/api/src/test-support/reset-db.ts. Never shipped.
import { createHash } from "node:crypto";
import postgres from "postgres";

const url = process.env.TEST_MIGRATION_DATABASE_URL;
if (!url) throw new Error("TEST_MIGRATION_DATABASE_URL is not set. Run `pnpm db:setup`.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("Refusing: the e2e seed truncates tables and runs only on a local database.");
}
const { projects, serverKey } = JSON.parse(process.env.E2E_SEED ?? "{}");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const hash = (token) => createHash("sha256").update(token).digest();
const prefix = (token) => token.slice(0, 16);

const tables = await sql`
  SELECT tablename AS name FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`;
await sql`TRUNCATE ${sql(tables.map((t) => t.name))} CASCADE`;

const [org] = await sql`INSERT INTO organizations (name, slug) VALUES ('e2e', 'e2e') RETURNING id`;
for (const [name, { slug, origin, key }] of Object.entries(projects)) {
  const [project] = await sql`
    INSERT INTO projects (organization_id, name, slug, allow_identify)
    VALUES (${org.id}, ${slug}, ${slug}, true) RETURNING id`;
  const [env] = await sql`
    INSERT INTO environments (project_id, name, allowed_origins, track_localhost)
    VALUES (${project.id}, 'production', ${[origin]}, true) RETURNING id`;
  const keys = [{ kind: "write_browser", token: key }];
  if (name === "next") keys.push({ kind: "write_server", token: serverKey });
  for (const { kind, token } of keys) {
    await sql`INSERT INTO api_keys (project_id, environment_id, kind, prefix, secret_hash)
              VALUES (${project.id}, ${env.id}, ${kind}, ${prefix(token)}, ${hash(token)})`;
  }
}
await sql.end();
console.log(`e2e seed: ${Object.keys(projects).length} projects`);
