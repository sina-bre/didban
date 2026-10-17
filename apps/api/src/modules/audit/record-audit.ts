import type { AuditAction, AuditTargetType } from "@didban/contracts";
import type postgres from "postgres";
import type { AccessScope } from "../../domain/permissions.js";
import { currentRequestMeta } from "../../http/request-context.js";
import { truncateIp } from "../auth/client-meta.js";

// Spec §11: actor, action, target, request ID, truncated IP, timestamp. Never secrets: details
// hold role names and changed field names only, never values typed by a user (ADR 0022).

export type AuditRecord = {
  action: AuditAction;
  actorUserId: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  target?: { type: AuditTargetType; id: string };
  details?: Record<string, string | string[]>;
};

/**
 * Pass the transaction that makes the change, so the change and its audit row commit together.
 * Request ID and IP come from the HTTP request context, if there is one.
 */
export async function recordAudit(
  sql: postgres.Sql | postgres.TransactionSql,
  record: AuditRecord,
): Promise<void> {
  const meta = currentRequestMeta();
  await sql`
    INSERT INTO audit_logs (organization_id, project_id, actor_user_id, action, target_type,
                            target_id, details, request_id, ip_prefix)
    VALUES (${record.organizationId ?? null}, ${record.projectId ?? null}, ${record.actorUserId},
            ${record.action}, ${record.target?.type ?? null}, ${record.target?.id ?? null},
            ${sql.json(record.details ?? {})}, ${meta?.requestId ?? null},
            ${meta ? truncateIp(meta.ip) : null})`;
}

/** Actor, organization and project of a change to a project the scope reaches. */
export function projectAudit(scope: AccessScope, projectId: string) {
  const organizationId = scope.projects.get(projectId)?.organizationId;
  if (!organizationId) throw new Error("projectAudit called for a project outside the scope");
  return { actorUserId: scope.userId, organizationId, projectId };
}

/** Changed field names of a partial update, for `details.fields`. */
export const changedFields = (changes: object): string[] => Object.keys(changes).sort();
