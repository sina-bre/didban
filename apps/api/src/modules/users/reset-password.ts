import type postgres from "postgres";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { organizationInScope } from "../access/in-scope.js";
import { recordAudit } from "../audit/record-audit.js";
import { hashPassword } from "../auth/password-hasher.js";
import { revokeAllSessions } from "../auth/revoke-sessions.js";
import { newTemporaryPassword } from "../auth/temporary-password.js";
import { lockOrganizationAs } from "../organizations/org-lock.js";

// Spec §11 password reset without email: a new temporary password, all sessions revoked, change
// forced at next login. Org owners reset only accounts that belong to their organization alone
// and are not platform admins (otherwise they could take over access elsewhere). Everything
// else is the operator's job: `pnpm cli reset-password <email>`.

export type ResetTarget = {
  organizationId: string | null;
  userId: string;
  actorUserId: string | null;
};

/** Shared core. The caller has already decided the actor may do this. Returns the new password. */
export async function applyPasswordReset(
  tx: postgres.TransactionSql,
  target: ResetTarget,
): Promise<string> {
  const temporaryPassword = newTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await tx`UPDATE users
           SET password_hash = ${passwordHash}, must_change_password = true, updated_at = now()
           WHERE id = ${target.userId}`;
  await revokeAllSessions(tx, target.userId);
  await recordAudit(tx, {
    action: "user.password_reset",
    actorUserId: target.actorUserId,
    organizationId: target.organizationId,
    target: { type: "user", id: target.userId },
  });
  return temporaryPassword;
}

export async function resetMemberPassword(
  sql: Sql,
  scope: AccessScope,
  input: { organizationId: string; userId: string },
): Promise<string> {
  const organizationId = organizationInScope(scope, input.organizationId);
  return sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, organizationId, scope.userId);
    if (actorRole !== "owner") throw new AppError(403, "FORBIDDEN", "Not allowed");
    if (input.userId === scope.userId) {
      throw new AppError(409, "USE_CHANGE_PASSWORD", "Change your own password instead");
    }
    const [user] = await tx<{ isPlatformAdmin: boolean; orgCount: number }[]>`
      SELECT u.is_platform_admin,
             (SELECT count(*)::int FROM memberships x WHERE x.user_id = u.id) AS org_count
      FROM users u JOIN memberships m ON m.user_id = u.id AND m.organization_id = ${organizationId}
      WHERE u.id = ${input.userId} FOR UPDATE OF u`;
    if (!user) throw notFound();
    if (user.isPlatformAdmin || user.orgCount > 1) {
      throw new AppError(403, "RESET_NEEDS_OPERATOR", "Ask the instance operator for a reset");
    }
    return applyPasswordReset(tx, { ...input, organizationId, actorUserId: scope.userId });
  });
}
