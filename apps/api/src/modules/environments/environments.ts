import type {
  Environment,
  EnvironmentListResponse,
  UpdateEnvironmentRequest,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { changedFields, projectAudit, recordAudit } from "../audit/record-audit.js";
import {
  checkedCidrs,
  ENVIRONMENT_COLUMNS,
  type EnvironmentRow,
  toEnvironment,
} from "./environment-row.js";

// Spec §9.1 environments of a project. Viewers list them (`project:view`, needed for the
// dashboard filter); project admins and org owners/admins change them (`project:manage`).

export async function listEnvironments(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<EnvironmentListResponse> {
  const rows = await sql<EnvironmentRow[]>`
    SELECT ${sql(ENVIRONMENT_COLUMNS)} FROM environments
    WHERE project_id = ${projectInScope(scope, projectId)} ORDER BY name`;
  return { environments: rows.map(toEnvironment) };
}

export async function updateEnvironment(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; environmentId: string; changes: UpdateEnvironmentRequest },
): Promise<Environment> {
  const cidrs = checkedCidrs(input.changes.excludedCidrs);
  const changes = cidrs ? { ...input.changes, excludedCidrs: cidrs } : input.changes;
  const projectId = projectInScope(scope, input.projectId);
  const columns = Object.keys(changes) as (keyof typeof changes)[];
  return sql.begin(async (tx) => {
    const [row] = await tx<EnvironmentRow[]>`
      UPDATE environments SET ${tx(changes, columns)}
      WHERE id = ${input.environmentId} AND project_id = ${projectId}
      RETURNING ${tx(ENVIRONMENT_COLUMNS)}`;
    if (!row) throw notFound();
    await recordAudit(tx, {
      ...projectAudit(scope, projectId),
      action: "environment.updated",
      target: { type: "environment", id: row.id },
      details: { fields: changedFields(changes) },
    });
    return toEnvironment(row);
  });
}
