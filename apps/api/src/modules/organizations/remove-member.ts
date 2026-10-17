import type { Sql } from "../../db/db.module.js";
import { checkMemberChange } from "../../domain/org-roles.js";
import { notFound } from "../../http/app-error.js";
import { countOwners, lockOrganizationAs, orgRoleOf, refusalError } from "./org-lock.js";

export type RemoveMemberInput = { actorUserId: string; organizationId: string; userId: string };

/**
 * Owner-only. The final owner cannot be removed. The user's project access in this organization
 * goes with the membership (foreign keys are RESTRICT, so it is deleted explicitly first).
 * Their account and memberships elsewhere stay.
 */
export async function removeMember(sql: Sql, input: RemoveMemberInput): Promise<void> {
  await sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, input.organizationId, input.actorUserId);
    const targetRole = await orgRoleOf(tx, input.organizationId, input.userId);
    if (!targetRole) throw notFound();
    const refusal = checkMemberChange({
      actorRole,
      targetRole,
      newRole: null,
      ownerCount: await countOwners(tx, input.organizationId),
    });
    if (refusal) throw refusalError(refusal);
    await tx`
      DELETE FROM project_members
      WHERE organization_id = ${input.organizationId} AND user_id = ${input.userId}`;
    await tx`
      DELETE FROM memberships
      WHERE organization_id = ${input.organizationId} AND user_id = ${input.userId}`;
  });
}
