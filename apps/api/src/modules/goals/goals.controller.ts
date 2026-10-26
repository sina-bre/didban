import {
  type CreateGoalRequest,
  createGoalRequestSchema,
  type Goal,
  type GoalListResponse,
  type UpdateGoalRequest,
  updateGoalRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { StatsGate } from "../analytics/stats-gate.js";
import { createGoal } from "./create-goal.js";
import { deleteGoal } from "./delete-goal.js";
import { listGoals } from "./list-goals.js";
import { updateGoal } from "./update-goal.js";

// Spec §11: goals are managed by org owners/admins and project admins; viewers may read them.
// A change drops the project's cached reports (spec §10's 15 s cache), so goal stats show it now.
@Controller("projects/:projectId/goals")
export class GoalsController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
  ) {}

  private async changed(projectId: string, change: Promise<Goal>): Promise<Goal> {
    const goal = await change;
    this.gate.forget(projectId);
    return goal;
  }

  @Requires("project:view")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<GoalListResponse> {
    return listGoals(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(createGoalRequestSchema)) body: CreateGoalRequest,
  ): Promise<Goal> {
    return this.changed(projectId, createGoal(this.sql, scope, { ...body, projectId }));
  }

  @Requires("project:manage")
  @Patch(":goalId")
  update(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("goalId", UuidPipe) goalId: string,
    @Body(new ZodPipe(updateGoalRequestSchema)) changes: UpdateGoalRequest,
  ): Promise<Goal> {
    return this.changed(projectId, updateGoal(this.sql, scope, { projectId, goalId, changes }));
  }

  @Requires("project:manage")
  @Delete(":goalId")
  remove(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("goalId", UuidPipe) goalId: string,
  ): Promise<Goal> {
    return this.changed(projectId, deleteGoal(this.sql, scope, { projectId, goalId }));
  }
}
