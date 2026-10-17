import type { Sql } from "../../db/db.module.js";
import type { ProjectRole } from "../../domain/org-roles.js";
import { notFound } from "../../http/app-error.js";
import { orgRoleOf } from "../organizations/org-lock.js";
import { authorizeProjectMemberChange } from "./project-member-access.js";

export type ProjectMemberInput = { actorUserId: string; projectId: string; userId: string };

/**
 * Gives an existing organization member access to a project, or changes their project role.
 * Only org members can be assigned (spec §9.1); anyone else is "not found" in this organization.
 */
export async function assignProjectMember(
  sql: Sql,
  input: ProjectMemberInput & { role: ProjectRole },
): Promise<void> {
  await sql.begin(async (tx) => {
    const organizationId = await authorizeProjectMemberChange(
      tx,
      input.projectId,
      input.actorUserId,
    );
    if (!(await orgRoleOf(tx, organizationId, input.userId))) throw notFound();
    await tx`
      INSERT INTO project_members (project_id, organization_id, user_id, role)
      VALUES (${input.projectId}, ${organizationId}, ${input.userId}, ${input.role})
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role`;
  });
}

export async function removeProjectMember(sql: Sql, input: ProjectMemberInput): Promise<void> {
  await sql.begin(async (tx) => {
    await authorizeProjectMemberChange(tx, input.projectId, input.actorUserId);
    const rows = await tx`
      DELETE FROM project_members
      WHERE project_id = ${input.projectId} AND user_id = ${input.userId}
      RETURNING user_id`;
    if (rows.length === 0) throw notFound();
  });
}
