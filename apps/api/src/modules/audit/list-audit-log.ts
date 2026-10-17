import type { AuditEntry, AuditLogQuery, AuditLogResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { organizationInScope } from "../access/in-scope.js";

// A constant bound (not `$x IS NULL OR ...`) keeps the cursor inside the index condition.
const MAX_BIGINT = "9223372036854775807";

type Row = Omit<AuditEntry, "createdAt" | "actor" | "target"> & {
  createdAt: Date;
  actorUserId: string | null;
  actorEmail: string | null;
  targetType: NonNullable<AuditEntry["target"]>["type"] | null;
  targetId: string | null;
};

const toEntry = ({ actorUserId, actorEmail, targetType, targetId, ...row }: Row): AuditEntry => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  actor: actorUserId ? { id: actorUserId, email: actorEmail } : null,
  target: targetType && targetId ? { type: targetType, id: targetId } : null,
});

/**
 * Newest first, keyset pagination on `id` (`org:audit`: owners and admins, spec §11). Served by
 * `audit_logs_organization_idx`; one extra row tells whether another page exists.
 */
export async function listAuditLog(
  sql: Sql,
  scope: AccessScope,
  input: AuditLogQuery & { organizationId: string },
): Promise<AuditLogResponse> {
  const rows = await sql<Row[]>`
    SELECT a.id, a.created_at, a.action, a.actor_user_id, u.email AS actor_email, a.project_id,
           a.target_type, a.target_id, a.details, a.request_id, a.ip_prefix
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE a.organization_id = ${organizationInScope(scope, input.organizationId)}
      AND a.id < ${input.before ?? MAX_BIGINT}::bigint
    ORDER BY a.id DESC
    LIMIT ${input.limit + 1}`;
  const page = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  return { entries: page.map(toEntry), nextBefore: hasMore ? (page.at(-1)?.id ?? null) : null };
}
