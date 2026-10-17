import {
  type AssignProjectMemberRequest,
  assignProjectMemberRequestSchema,
  type Project,
  type ProjectListResponse,
  type UpdateProjectRequest,
  updateProjectRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Put } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { listProjects } from "./list-projects.js";
import { assignProjectMember, removeProjectMember } from "./project-members.js";
import { getProject, updateProject } from "./project-settings.js";

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("self")
  @Get()
  list(@CurrentScope() scope: AccessScope): Promise<ProjectListResponse> {
    return listProjects(this.sql, scope);
  }

  @Requires("project:view")
  @Get(":projectId")
  get(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<Project> {
    return getProject(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Patch(":projectId")
  update(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(updateProjectRequestSchema)) changes: UpdateProjectRequest,
  ): Promise<Project> {
    return updateProject(this.sql, scope, { projectId, changes });
  }

  @Requires("project:members")
  @Put(":projectId/members/:userId")
  @HttpCode(204)
  async assignMember(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("userId", UuidPipe) userId: string,
    @Body(new ZodPipe(assignProjectMemberRequestSchema)) body: AssignProjectMemberRequest,
  ): Promise<void> {
    await assignProjectMember(this.sql, {
      actorUserId: scope.userId,
      projectId,
      userId,
      role: body.role,
    });
  }

  @Requires("project:members")
  @Delete(":projectId/members/:userId")
  @HttpCode(204)
  async removeMember(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("userId", UuidPipe) userId: string,
  ): Promise<void> {
    await removeProjectMember(this.sql, { actorUserId: scope.userId, projectId, userId });
  }
}
