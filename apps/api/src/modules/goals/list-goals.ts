import type { GoalListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { projectInScope } from "../access/in-scope.js";
import { goalRows, toGoal } from "./goal-row.js";

/** `project:view`: everyone who sees the reports sees what the goals are. */
export async function listGoals(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<GoalListResponse> {
  const rows = await goalRows(sql, projectInScope(scope, projectId));
  return { goals: rows.map(toGoal) };
}
