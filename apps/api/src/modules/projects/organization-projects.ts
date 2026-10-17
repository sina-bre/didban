import type { OrganizationProjectListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";
import { organizationInScope } from "../access/in-scope.js";

// Org owners/admins (`org:projects`): the organization's project list including archived ones,
// and archive / restore. Archived projects drop out of every AccessScope (ADR 0019).

export async function listOrganizationProjects(
  sql: Sql,
  scope: AccessScope,
  organizationId: string,
): Promise<OrganizationProjectListResponse> {
  const rows = await sql<{ id: string; name: string; slug: string; archivedAt: Date | null }[]>`
    SELECT id, name, slug, archived_at FROM projects
    WHERE organization_id = ${organizationInScope(scope, organizationId)}
    ORDER BY archived_at NULLS FIRST, name, id`;
  return {
    projects: rows.map((row) => ({ ...row, archivedAt: row.archivedAt?.toISOString() ?? null })),
  };
}

export type SetArchivedInput = { organizationId: string; projectId: string; archived: boolean };

/** A project of another organization is "not found", even with a valid organization ID. */
export async function setProjectArchived(
  sql: Sql,
  scope: AccessScope,
  input: SetArchivedInput,
): Promise<void> {
  const rows = await sql`
    UPDATE projects
    SET archived_at = CASE WHEN ${input.archived} THEN coalesce(archived_at, now()) END
    WHERE id = ${input.projectId}
      AND organization_id = ${organizationInScope(scope, input.organizationId)}
    RETURNING id`;
  if (rows.length === 0) throw notFound();
}
