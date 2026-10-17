import type { ProjectListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";

/** Projects the caller can reach (spec §11 access rule, already applied by the scope). */
export async function listProjects(sql: Sql, scope: AccessScope): Promise<ProjectListResponse> {
  const ids = [...scope.projects.keys()];
  if (ids.length === 0) return { projects: [] };
  const rows = await sql<{ id: string; organizationId: string; name: string; slug: string }[]>`
    SELECT id, organization_id, name, slug FROM projects WHERE id IN ${sql(ids)} ORDER BY name, id`;
  return {
    projects: rows.map((row) => ({
      ...row,
      role: scope.projects.get(row.id)?.projectRole ?? null,
    })),
  };
}
