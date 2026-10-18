import { type CreateGoalRequest, MAX_GOALS } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { GOAL_COLUMNS, inProject } from "./goal-change.js";
import { checkedPathPattern, type GoalRow } from "./goal-row.js";

export function createGoal(
  sql: Sql,
  scope: AccessScope,
  input: CreateGoalRequest & { projectId: string },
) {
  const { projectId, ...goal } = input;
  const values = {
    name: goal.name,
    kind: goal.kind,
    eventName: goal.kind === "event" ? goal.eventName : null,
    pathPattern: goal.kind === "page" ? checkedPathPattern(goal.pathPattern) : null,
  };
  return inProject(sql, scope, { projectId, action: "goal.created" }, async (tx, id) => {
    const [count] = await tx<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM goals WHERE project_id = ${id}`;
    if ((count?.n ?? 0) >= MAX_GOALS)
      throw new AppError(409, "GOAL_LIMIT_REACHED", `At most ${MAX_GOALS} goals per project`);
    const [row] = await tx<GoalRow[]>`
      INSERT INTO goals ${tx({ ...values, projectId: id })} RETURNING ${tx(GOAL_COLUMNS)}`;
    return row;
  });
}
