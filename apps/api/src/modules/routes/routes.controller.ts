import {
  type CreateRouteTemplateRequest,
  createRouteTemplateRequestSchema,
  type RoutePreviewRequest,
  type RoutePreviewResponse,
  type RouteTemplate,
  type RouteTemplateListResponse,
  routePreviewRequestSchema,
  type UpdateRouteTemplateRequest,
  updateRouteTemplateRequestSchema,
} from "@didban/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import * as change from "./change-route-templates.js";
import { listRouteTemplates, previewRoutes } from "./route-templates.js";

// Spec §10 `…/routes`: project admins and org owners/admins (`project:manage`, spec §11).
@Controller("projects/:projectId/routes")
export class RoutesController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("project:manage")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<RouteTemplateListResponse> {
    return listRouteTemplates(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(createRouteTemplateRequestSchema)) body: CreateRouteTemplateRequest,
  ): Promise<RouteTemplate> {
    return change.createRouteTemplate(this.sql, scope, { ...body, projectId });
  }

  @Requires("project:manage")
  @Post("preview")
  @HttpCode(200)
  preview(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(routePreviewRequestSchema)) body: RoutePreviewRequest,
  ): Promise<RoutePreviewResponse> {
    return previewRoutes(this.sql, scope, { ...body, projectId });
  }

  @Requires("project:manage")
  @Patch(":routeId")
  update(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("routeId", UuidPipe) routeId: string,
    @Body(new ZodPipe(updateRouteTemplateRequestSchema)) changes: UpdateRouteTemplateRequest,
  ): Promise<RouteTemplate> {
    return change.updateRouteTemplate(this.sql, scope, { projectId, routeId, changes });
  }

  @Requires("project:manage")
  @Delete(":routeId")
  @HttpCode(204)
  async remove(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("routeId", UuidPipe) routeId: string,
  ): Promise<void> {
    await change.deleteRouteTemplate(this.sql, scope, { projectId, routeId });
  }
}
