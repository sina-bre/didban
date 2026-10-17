import type { Sql } from "../../db/db.module.js";
import type { OrgRole, ProjectRole } from "../../domain/org-roles.js";
import type { AccessScope, ProjectAccess } from "../../domain/permissions.js";

export type ScopeSubject = { userId: string; isPlatformAdmin: boolean };

type ProjectRow = {
  id: string;
  organizationId: string;
  orgRole: OrgRole;
  projectRole: ProjectRole | null;
};

/**
 * Spec §11 access rule, loaded once per request: org owners/admins reach every live project of
 * their organization, org members only projects with a `project_members` row. Suspended
 * organizations and archived projects are invisible. Being a platform admin adds nothing here.
 * Served by the unique (user_id, organization_id) indexes and the project_members primary key.
 */
export async function loadAccessScope(sql: Sql, subject: ScopeSubject): Promise<AccessScope> {
  const [orgRows, projectRows] = await Promise.all([
    sql<{ organizationId: string; role: OrgRole }[]>`
      SELECT m.organization_id, m.role
      FROM memberships m JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ${subject.userId} AND o.suspended_at IS NULL`,
    sql<ProjectRow[]>`
      SELECT p.id, p.organization_id, m.role AS org_role, pm.role AS project_role
      FROM memberships m
      JOIN organizations o ON o.id = m.organization_id AND o.suspended_at IS NULL
      JOIN projects p ON p.organization_id = m.organization_id AND p.archived_at IS NULL
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = m.user_id
      WHERE m.user_id = ${subject.userId}
        AND (m.role IN ('owner', 'admin') OR pm.role IS NOT NULL)`,
  ]);
  const projects = new Map<string, ProjectAccess>();
  for (const { id, ...access } of projectRows) projects.set(id, access);
  return {
    userId: subject.userId,
    isPlatformAdmin: subject.isPlatformAdmin,
    organizations: new Map(orgRows.map((row) => [row.organizationId, row.role])),
    projects,
  };
}
