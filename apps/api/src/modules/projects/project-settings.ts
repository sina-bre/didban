import type { Project, UpdateProjectRequest } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { changedFields, recordAudit } from "../audit/record-audit.js";
import { PROJECT_COLUMNS, type ProjectRow, toProject } from "./project-row.js";

/** One project with its settings (`project:view`). */
export async function getProject(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<Project> {
  const [row] = await sql<ProjectRow[]>`
    SELECT ${sql(PROJECT_COLUMNS)} FROM projects WHERE id = ${projectInScope(scope, projectId)}`;
  if (!row) throw notFound();
  return toProject(row);
}

/** Partial settings update (`project:manage`). Keys come from the Zod schema, never the raw body. */
export async function updateProject(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; changes: UpdateProjectRequest },
): Promise<Project> {
  const id = projectInScope(scope, input.projectId);
  const columns = Object.keys(input.changes) as (keyof UpdateProjectRequest)[];
  return sql.begin(async (tx) => {
    const [row] = await tx<ProjectRow[]>`
      UPDATE projects SET ${tx(input.changes, columns)}
      WHERE id = ${id} AND archived_at IS NULL
      RETURNING ${tx(PROJECT_COLUMNS)}`;
    if (!row) throw notFound();
    await recordAudit(tx, {
      action: "project.updated",
      actorUserId: scope.userId,
      organizationId: row.organizationId,
      projectId: id,
      target: { type: "project", id },
      details: { fields: changedFields(input.changes) },
    });
    return toProject(row);
  });
}
