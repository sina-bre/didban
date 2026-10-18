import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { GOAL_COLUMNS, inProject } from "./goal-change.js";
import type { GoalRow } from "./goal-row.js";

export function deleteGoal(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; goalId: string },
) {
  return inProject(
    sql,
    scope,
    { projectId: input.projectId, action: "goal.deleted" },
    async (tx, id) => {
      const [row] = await tx<GoalRow[]>`
      DELETE FROM goals WHERE id = ${input.goalId} AND project_id = ${id} RETURNING ${tx(GOAL_COLUMNS)}`;
      return row;
    },
  );
}
