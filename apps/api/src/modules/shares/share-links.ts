import { randomBytes } from "node:crypto";
import {
  type CreatedShareLink,
  type CreateShareLinkRequest,
  MAX_ACTIVE_SHARE_LINKS,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { projectAudit, recordAudit } from "../audit/record-audit.js";
import { COLUMNS, hashShareToken, type Row, toShareLink } from "./share-link-row.js";

// `project:manage` (spec §11). 256-bit random token, shown once; only SHA-256 is stored (spec
// §9.1 reasoning for high-entropy secrets). Revoking is permanent; the row stays for the audit.

export function createShareLink(
  sql: Sql,
  scope: AccessScope,
  input: CreateShareLinkRequest & { projectId: string },
): Promise<CreatedShareLink> {
  const projectId = projectInScope(scope, input.projectId);
  const token = `dsh_${randomBytes(32).toString("base64url")}`;
  return sql.begin(async (tx) => {
    await tx`SELECT 1 FROM projects WHERE id = ${projectId} FOR UPDATE`;
    const [active] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM share_links WHERE project_id = ${projectId} AND revoked_at IS NULL`;
    if ((active?.n ?? 0) >= MAX_ACTIVE_SHARE_LINKS) {
      throw new AppError(
        409,
        "SHARE_LINK_LIMIT_REACHED",
        "Revoke a share link before creating another",
      );
    }
    const values = {
      projectId,
      label: input.label,
      tokenHash: hashShareToken(token),
      createdBy: scope.userId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    };
    const [row] = await tx<Row[]>`INSERT INTO share_links ${tx(values)} RETURNING ${tx(COLUMNS)}`;
    if (!row) throw new Error("insert returned no row");
    await recordAudit(tx, {
      ...projectAudit(scope, projectId),
      action: "share_link.created",
      target: { type: "share_link", id: row.id },
    });
    return { ...toShareLink(row), token };
  });
}

export function revokeShareLink(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; shareId: string },
) {
  const projectId = projectInScope(scope, input.projectId);
  return sql.begin(async (tx) => {
    const [row] = await tx<Row[]>`
      UPDATE share_links SET revoked_at = coalesce(revoked_at, now())
      WHERE id = ${input.shareId} AND project_id = ${projectId} RETURNING ${tx(COLUMNS)}`;
    if (!row) throw notFound();
    await recordAudit(tx, {
      ...projectAudit(scope, projectId),
      action: "share_link.revoked",
      target: { type: "share_link", id: row.id },
    });
    return toShareLink(row);
  });
}
