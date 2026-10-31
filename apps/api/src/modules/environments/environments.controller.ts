import {
  type CreateEnvironmentRequest,
  createEnvironmentRequestSchema,
  type Environment,
  type EnvironmentListResponse,
  type UpdateEnvironmentRequest,
  updateEnvironmentRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { WriteKeyCache } from "../key-cache/write-key-cache.js";
import { createEnvironment } from "./create-environment.js";
import { listEnvironments, updateEnvironment } from "./environments.js";

@Controller("projects/:projectId/environments")
export class EnvironmentsController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly keys: WriteKeyCache,
  ) {}

  @Requires("project:view")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<EnvironmentListResponse> {
    return listEnvironments(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(createEnvironmentRequestSchema)) body: CreateEnvironmentRequest,
  ): Promise<Environment> {
    return createEnvironment(this.sql, scope, { ...body, projectId });
  }

  @Requires("project:manage")
  @Patch(":environmentId")
  async update(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("environmentId", UuidPipe) environmentId: string,
    @Body(new ZodPipe(updateEnvironmentRequestSchema)) changes: UpdateEnvironmentRequest,
  ): Promise<Environment> {
    const updated = await updateEnvironment(this.sql, scope, { projectId, environmentId, changes });
    this.keys.forgetEnvironment(environmentId); // new origins/exclusions apply to the next event
    return updated;
  }
}
