import type { UpdateGoalRequest } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { changedFields } from "../audit/record-audit.js";
import { GOAL_COLUMNS, inProject } from "./goal-change.js";
import { checkedPathPattern, type GoalRow } from "./goal-row.js";

export function updateGoal(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; goalId: string; changes: UpdateGoalRequest },
) {
  const { changes } = input;
  const fields = changedFields(changes);
  const action = { projectId: input.projectId, action: "goal.updated" as const, fields };
  return inProject(sql, scope, action, async (tx, id) => {
    const [goal] = await tx<
      GoalRow[]
    >`SELECT kind FROM goals WHERE id = ${input.goalId} AND project_id = ${id}`;
    if (!goal) return undefined;
    const wrongKind = goal.kind === "event" ? changes.pathPattern : changes.eventName;
    if (wrongKind !== undefined)
      throw new AppError(400, "VALIDATION_FAILED", "Field does not fit the goal kind");
    const set = {
      ...changes,
      ...(changes.pathPattern ? { pathPattern: checkedPathPattern(changes.pathPattern) } : {}),
    };
    const [row] = await tx<GoalRow[]>`
      UPDATE goals SET ${tx(set)} WHERE id = ${input.goalId} AND project_id = ${id} RETURNING ${tx(GOAL_COLUMNS)}`;
    return row;
  });
}
