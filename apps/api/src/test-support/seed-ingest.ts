import type { ApiKeyKind } from "@didban/contracts";
import type { Sql } from "../db/db.module.js";
import { newApiKeyToken } from "../modules/api-keys/api-key-token.js";
import { seedOrg, seedProject } from "./seed-org.js";

export const SITE = "https://heliumpark.example";
/** A real desktop browser: requests without a user agent are filtered as bots (spec §7 step 6). */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/** One org → project → environment (allowing SITE) with a browser and a server write key. */
export async function seedIngestTarget(sql: Sql, slug = "heliumpark") {
  const organizationId = await seedOrg(sql, slug);
  const projectId = await seedProject(sql, organizationId, slug);
  const [env] = await sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name, allowed_origins)
    VALUES (${projectId}, 'production', ${[SITE]}) RETURNING id`;
  if (!env) throw new Error("no environment row");
  const key = async (kind: ApiKeyKind) => {
    const { token, prefix, secretHash } = newApiKeyToken(kind);
    await sql`INSERT INTO api_keys (project_id, environment_id, kind, prefix, secret_hash)
              VALUES (${projectId}, ${env.id}, ${kind}, ${prefix}, ${secretHash})`;
    return token;
  };
  return {
    organizationId,
    projectId,
    environmentId: env.id,
    browserKey: await key("write_browser"),
    serverKey: await key("write_server"),
  };
}

/** A schema-valid batch, `sentAt` = now, one page view per given offset (ms before now). */
export function batchBody(writeKey: string | undefined, eventAgesMs: number[] = [0]) {
  const now = Date.now();
  return {
    schemaVersion: 1,
    sentAt: new Date(now).toISOString(),
    ...(writeKey ? { writeKey } : {}),
    events: eventAgesMs.map((age, i) => ({
      eventId: `0192f3a0-7b1c-7c3e-9f10-2a4d5e6f7a${String(i).padStart(2, "0")}`,
      type: "page",
      occurredAt: new Date(now - age).toISOString(),
      url: `${SITE}/pricing`,
    })),
  };
}
