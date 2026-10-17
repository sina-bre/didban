import type { CreateProjectRequest, Project } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { nextFreeSlug, slugify } from "../../domain/slug.js";
import { organizationInScope } from "../access/in-scope.js";
import { recordAudit } from "../audit/record-audit.js";
import { PROJECT_COLUMNS, type ProjectRow, toProject } from "./project-row.js";

export type CreateProjectInput = CreateProjectRequest & { organizationId: string };

/**
 * Org owners/admins create projects (spec §11, `org:projects` on the route). The slug is derived
 * from the name and made unique inside the organization. Settings start at the DB defaults.
 */
export async function createProject(
  sql: Sql,
  scope: AccessScope,
  input: CreateProjectInput,
): Promise<Project> {
  const organizationId = organizationInScope(scope, input.organizationId);
  const base = slugify(input.name, "project");
  return sql.begin(async (tx) => {
    const taken = await tx<{ slug: string }[]>`
      SELECT slug FROM projects
      WHERE organization_id = ${organizationId} AND (slug = ${base} OR slug LIKE ${`${base}-%`})`;
    const [row] = await tx<ProjectRow[]>`
      INSERT INTO projects (organization_id, name, slug, reporting_timezone)
      VALUES (${organizationId}, ${input.name}, ${nextFreeSlug(base, new Set(taken.map((r) => r.slug)))},
              ${input.reportingTimezone ?? "UTC"})
      RETURNING ${tx(PROJECT_COLUMNS)}`;
    if (!row) throw new Error("insert returned no row");
    await recordAudit(tx, {
      action: "project.created",
      actorUserId: scope.userId,
      organizationId,
      projectId: row.id,
      target: { type: "project", id: row.id },
    });
    return toProject(row);
  });
}
