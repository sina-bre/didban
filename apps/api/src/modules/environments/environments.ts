import type {
  CreateEnvironmentRequest,
  Environment,
  EnvironmentListResponse,
  UpdateEnvironmentRequest,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import {
  checkedCidrs,
  ENVIRONMENT_COLUMNS,
  type EnvironmentRow,
  toEnvironment,
} from "./environment-row.js";

// Spec §9.1 environments of a project. Viewers list them (`project:view`, needed for the
// dashboard filter); project admins and org owners/admins change them (`project:manage`).

const UNIQUE_VIOLATION = "23505";

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

export async function createEnvironment(
  sql: Sql,
  scope: AccessScope,
  input: CreateEnvironmentRequest & { projectId: string },
): Promise<Environment> {
  const { projectId, excludedCidrs, ...rest } = input;
  const row = { ...rest, projectId: projectInScope(scope, projectId) };
  const cidrs = checkedCidrs(excludedCidrs);
  const values = cidrs ? { ...row, excludedCidrs: cidrs } : row;
  try {
    const [created] = await sql<EnvironmentRow[]>`
      INSERT INTO environments ${sql(values)} RETURNING ${sql(ENVIRONMENT_COLUMNS)}`;
    if (!created) throw new Error("insert returned no row");
    return toEnvironment(created);
  } catch (error) {
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
    throw new AppError(409, "ENVIRONMENT_EXISTS", "An environment with this name already exists");
  }
}

export async function updateEnvironment(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; environmentId: string; changes: UpdateEnvironmentRequest },
): Promise<Environment> {
  const cidrs = checkedCidrs(input.changes.excludedCidrs);
  const changes = cidrs ? { ...input.changes, excludedCidrs: cidrs } : input.changes;
  const [row] = await sql<EnvironmentRow[]>`
    UPDATE environments SET ${sql(changes, Object.keys(changes) as (keyof typeof changes)[])}
    WHERE id = ${input.environmentId} AND project_id = ${projectInScope(scope, input.projectId)}
    RETURNING ${sql(ENVIRONMENT_COLUMNS)}`;
  if (!row) throw notFound();
  return toEnvironment(row);
}
