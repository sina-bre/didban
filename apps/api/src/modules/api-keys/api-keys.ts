import {
  type ApiKey,
  type ApiKeyKind,
  type ApiKeyListResponse,
  type CreatedApiKey,
  MAX_ACTIVE_KEYS_PER_ENVIRONMENT,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { newApiKeyToken } from "./api-key-token.js";

// Write keys of a project (`project:manage`). Revocation reaches ingestion within the key cache
// TTL (spec §7 step 2, Stage 3). Keys are never deleted, so `last_used_at` history stays.

type KeyRow = Omit<ApiKey, "createdAt" | "lastUsedAt" | "revokedAt"> & {
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const toApiKey = (row: KeyRow): ApiKey => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
});

export async function listApiKeys(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<ApiKeyListResponse> {
  const rows = await sql<KeyRow[]>`
    SELECT id, environment_id, kind, prefix, created_at, last_used_at, revoked_at FROM api_keys
    WHERE project_id = ${projectInScope(scope, projectId)}
    ORDER BY revoked_at NULLS FIRST, created_at DESC, id`;
  return { keys: rows.map(toApiKey) };
}

export type CreateApiKeyInput = { projectId: string; environmentId: string; kind: ApiKeyKind };

/** Returns the token once. The environment row lock keeps the active-key cap exact. */
export async function createApiKey(
  sql: Sql,
  scope: AccessScope,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  const projectId = projectInScope(scope, input.projectId);
  return sql.begin(async (tx) => {
    const [env] = await tx`
      SELECT id FROM environments WHERE id = ${input.environmentId} AND project_id = ${projectId} FOR UPDATE`;
    if (!env) throw notFound();
    const [active] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM api_keys
      WHERE project_id = ${projectId} AND environment_id = ${input.environmentId} AND revoked_at IS NULL`;
    if ((active?.n ?? 0) >= MAX_ACTIVE_KEYS_PER_ENVIRONMENT) {
      throw new AppError(409, "KEY_LIMIT_REACHED", "Revoke a key before creating another");
    }
    const { token, prefix, secretHash } = newApiKeyToken(input.kind);
    const [row] = await tx<KeyRow[]>`
      INSERT INTO api_keys (project_id, environment_id, kind, prefix, secret_hash, created_by)
      VALUES (${projectId}, ${input.environmentId}, ${input.kind}, ${prefix}, ${secretHash}, ${scope.userId})
      RETURNING id, environment_id, kind, prefix, created_at, last_used_at, revoked_at`;
    if (!row) throw new Error("insert returned no row");
    return { ...toApiKey(row), token };
  });
}

/** Idempotent: revoking a revoked key keeps the first `revoked_at`. */
export async function revokeApiKey(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; keyId: string },
): Promise<void> {
  const rows = await sql`
    UPDATE api_keys SET revoked_at = coalesce(revoked_at, now())
    WHERE id = ${input.keyId} AND project_id = ${projectInScope(scope, input.projectId)}
    RETURNING id`;
  if (rows.length === 0) throw notFound();
}
