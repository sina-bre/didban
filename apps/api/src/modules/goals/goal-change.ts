import type { AuditAction, Goal } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { projectAudit, recordAudit } from "../audit/record-audit.js";
import { type GoalRow, isNameTaken, toGoal } from "./goal-row.js";

// `project:manage` (spec §11). Each change locks the project row (the 50-goal cap holds under
// concurrency) and commits with its audit row, which keeps field names only (ADR 0022).

export type Change = { projectId: string; action: AuditAction; fields?: string[] };

export async function inProject(
  sql: Sql,
  scope: AccessScope,
  change: Change,
  run: (tx: Sql, projectId: string) => Promise<GoalRow | undefined>,
): Promise<Goal> {
  const projectId = projectInScope(scope, change.projectId);
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT 1 FROM projects WHERE id = ${projectId} FOR UPDATE`;
      const row = await run(tx as unknown as Sql, projectId);
      if (!row) throw notFound();
      await recordAudit(tx, {
        ...projectAudit(scope, projectId),
        action: change.action,
        target: { type: "goal", id: row.id },
        ...(change.fields ? { details: { fields: change.fields } } : {}),
      });
      return toGoal(row);
    });
  } catch (error) {
    if (!isNameTaken(error)) throw error;
    throw new AppError(409, "GOAL_EXISTS", "A goal with this name already exists");
  }
}

export const GOAL_COLUMNS = ["id", "name", "kind", "event_name", "path_pattern", "created_at"];
