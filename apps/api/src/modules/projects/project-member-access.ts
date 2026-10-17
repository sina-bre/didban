import type postgres from "postgres";
import { canManageProjectMembers, type ProjectRole } from "../../domain/org-roles.js";
import { AppError, notFound } from "../../http/app-error.js";
import { lockOrganizationAs } from "../organizations/org-lock.js";

/**
 * Loads the project, locks its organization and checks the actor may assign project access
 * (spec §11). Cannot see the project → 404; can see it but lacks the right → 403.
 * Returns the project's organization ID.
 */
export async function authorizeProjectMemberChange(
  tx: postgres.TransactionSql,
  projectId: string,
  actorUserId: string,
): Promise<string> {
  const [project] = await tx<{ organizationId: string }[]>`
    SELECT organization_id FROM projects WHERE id = ${projectId} AND archived_at IS NULL`;
  if (!project) throw notFound();
  const orgRole = await lockOrganizationAs(tx, project.organizationId, actorUserId);
  const [own] = await tx<{ role: ProjectRole }[]>`
    SELECT role FROM project_members WHERE project_id = ${projectId} AND user_id = ${actorUserId}`;
  const projectRole = own?.role ?? null;
  if (orgRole === "member" && !projectRole) throw notFound();
  if (!canManageProjectMembers(orgRole, projectRole)) {
    throw new AppError(403, "FORBIDDEN", "Not allowed");
  }
  return project.organizationId;
}
