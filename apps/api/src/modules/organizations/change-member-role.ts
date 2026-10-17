import type { Sql } from "../../db/db.module.js";
import { checkMemberChange, type OrgRole } from "../../domain/org-roles.js";
import { notFound } from "../../http/app-error.js";
import { revokeAllSessions } from "../auth/revoke-sessions.js";
import { countOwners, lockOrganizationAs, orgRoleOf, refusalError } from "./org-lock.js";

export type ChangeMemberRoleInput = {
  actorUserId: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
};

/** Owner-only. The final owner cannot be demoted. A real change revokes the target's sessions. */
export async function changeMemberRole(sql: Sql, input: ChangeMemberRoleInput): Promise<void> {
  await sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, input.organizationId, input.actorUserId);
    const targetRole = await orgRoleOf(tx, input.organizationId, input.userId);
    if (!targetRole) throw notFound();
    const refusal = checkMemberChange({
      actorRole,
      targetRole,
      newRole: input.role,
      ownerCount: await countOwners(tx, input.organizationId),
    });
    if (refusal) throw refusalError(refusal);
    if (targetRole === input.role) return;
    await tx`
      UPDATE memberships SET role = ${input.role}
      WHERE organization_id = ${input.organizationId} AND user_id = ${input.userId}`;
    await revokeAllSessions(tx, input.userId);
  });
}
