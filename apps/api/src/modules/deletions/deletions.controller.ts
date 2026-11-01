import {
  type CreateDataDeletionRequest,
  createDataDeletionRequestSchema,
  type DataDeletion,
  type DataDeletionListResponse,
} from "@didban/contracts";
import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createDataDeletion, listDataDeletions } from "./data-deletions.js";

// Spec §11: deletions are managed like keys and shares (org owner/admin, project admin).
@Controller("projects/:projectId/deletions")
export class DeletionsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("project:manage")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<DataDeletionListResponse> {
    return listDataDeletions(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(createDataDeletionRequestSchema)) body: CreateDataDeletionRequest,
  ): Promise<DataDeletion> {
    return createDataDeletion(this.sql, scope, { projectId, body });
  }
}
