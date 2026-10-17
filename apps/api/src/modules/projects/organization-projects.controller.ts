import {
  type CreateProjectRequest,
  createProjectRequestSchema,
  type OrganizationProjectListResponse,
  type Project,
  type SetProjectArchivedRequest,
  setProjectArchivedRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createProject } from "./create-project.js";
import { listOrganizationProjects, setProjectArchived } from "./organization-projects.js";

/** Create, list and archive projects: org owners/admins only (spec §11). */
@Controller("organizations/:organizationId/projects")
export class OrganizationProjectsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("org:projects")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
  ): Promise<OrganizationProjectListResponse> {
    return listOrganizationProjects(this.sql, scope, organizationId);
  }

  @Requires("org:projects")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(createProjectRequestSchema)) body: CreateProjectRequest,
  ): Promise<Project> {
    return createProject(this.sql, scope, { ...body, organizationId });
  }

  @Requires("org:projects")
  @Patch(":projectId")
  @HttpCode(204)
  async setArchived(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(setProjectArchivedRequestSchema)) body: SetProjectArchivedRequest,
  ): Promise<void> {
    await setProjectArchived(this.sql, scope, { organizationId, projectId, ...body });
  }
}
