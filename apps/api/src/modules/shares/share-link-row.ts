import { createHash } from "node:crypto";
import type { ShareLink, ShareLinkListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { projectInScope } from "../access/in-scope.js";

// Share link rows as stored (migration 0012) and as the API lists them (never the token).

export type Row = {
  id: string;
  label: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
export const COLUMNS = ["id", "label", "created_at", "expires_at", "revoked_at"];

export const toShareLink = (r: Row): ShareLink => ({
  id: r.id,
  label: r.label,
  createdAt: r.createdAt.toISOString(),
  expiresAt: r.expiresAt?.toISOString() ?? null,
  revokedAt: r.revokedAt?.toISOString() ?? null,
});

export const hashShareToken = (token: string) => createHash("sha256").update(token).digest();

export async function listShareLinks(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<ShareLinkListResponse> {
  const rows = await sql<Row[]>`
    SELECT ${sql(COLUMNS)} FROM share_links
    WHERE project_id = ${projectInScope(scope, projectId)} ORDER BY created_at DESC, id`;
  return { shareLinks: rows.map(toShareLink) };
}
