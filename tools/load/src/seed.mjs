// One fresh org → project → environment (allowing SITE) → browser write key per run, written with
// plain SQL like apps/api/src/test-support/seed-ingest.ts. Token format: api-key-token.ts.
import { createHash, randomBytes } from "node:crypto";
import { SITE } from "./batch.mjs";

function newBrowserKey() {
  const prefix = `dpk_${randomBytes(6).toString("hex")}`;
  const token = `${prefix}_${randomBytes(32).toString("base64url")}`;
  return { token, prefix, secretHash: createHash("sha256").update(token).digest() };
}

export async function seedTarget(sql) {
  const slug = `load-${Date.now()}`;
  const [org] = await sql`
    INSERT INTO organizations (name, slug) VALUES (${slug}, ${slug}) RETURNING id`;
  const [project] = await sql`
    INSERT INTO projects (organization_id, name, slug)
    VALUES (${org.id}, ${slug}, ${slug}) RETURNING id`;
  const [env] = await sql`
    INSERT INTO environments (project_id, name, allowed_origins)
    VALUES (${project.id}, 'production', ${[SITE]}) RETURNING id`;
  const key = newBrowserKey();
  await sql`INSERT INTO api_keys (project_id, environment_id, kind, prefix, secret_hash)
            VALUES (${project.id}, ${env.id}, 'write_browser', ${key.prefix}, ${key.secretHash})`;
  return { slug, projectId: project.id, writeKey: key.token };
}
