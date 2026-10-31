import type { ProjectMemberListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { ProjectRole } from "../../domain/org-roles.js";
import type { AccessScope } from "../../domain/permissions.js";
import { projectInScope } from "../access/in-scope.js";

type Row = { userId: string; email: string; role: ProjectRole | null };

/**
 * `project:members`: the project's assigned members, and the organization's plain `member`s
 * without a role here (the only people an assignment can add). Owners and admins see every
 * project through their org role, so neither list holds them.
 */
export async function listProjectMembers(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<ProjectMemberListResponse> {
  const id = projectInScope(scope, projectId);
  const rows = await sql<Row[]>`
    SELECT u.id AS user_id, u.email, pm.role
    FROM projects p
    JOIN memberships m ON m.organization_id = p.organization_id
    JOIN users u ON u.id = m.user_id
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = m.user_id
    WHERE p.id = ${id} AND (pm.role IS NOT NULL OR m.role = 'member')
    ORDER BY u.email`;
  return {
    members: rows.flatMap(({ role, ...user }) => (role ? [{ ...user, role }] : [])),
    candidates: rows.filter((row) => !row.role).map(({ userId, email }) => ({ userId, email })),
  };
}
