import type { CreateEnvironmentRequest, Environment } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { projectAudit, recordAudit } from "../audit/record-audit.js";
import {
  checkedCidrs,
  ENVIRONMENT_COLUMNS,
  type EnvironmentRow,
  toEnvironment,
} from "./environment-row.js";

const UNIQUE_VIOLATION = "23505";

/** `project:manage`. A duplicate name is 409; the audit row commits with the environment. */
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
    return await sql.begin(async (tx) => {
      const [created] = await tx<EnvironmentRow[]>`
        INSERT INTO environments ${tx(values)} RETURNING ${tx(ENVIRONMENT_COLUMNS)}`;
      if (!created) throw new Error("insert returned no row");
      await recordAudit(tx, {
        ...projectAudit(scope, row.projectId),
        action: "environment.created",
        target: { type: "environment", id: created.id },
      });
      return toEnvironment(created);
    });
  } catch (error) {
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
    throw new AppError(409, "ENVIRONMENT_EXISTS", "An environment with this name already exists");
  }
}
