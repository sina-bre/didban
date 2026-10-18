import {
  type CreatedShareLink,
  type CreateShareLinkRequest,
  createShareLinkRequestSchema,
  type ShareLink,
  type ShareLinkListResponse,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { listShareLinks } from "./share-link-row.js";
import { createShareLink, revokeShareLink } from "./share-links.js";

// Spec §11: shares are managed like keys (org owner/admin, project admin).
@Controller("projects/:projectId/shares")
export class SharesController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("project:manage")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<ShareLinkListResponse> {
    return listShareLinks(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Body(new ZodPipe(createShareLinkRequestSchema)) body: CreateShareLinkRequest,
  ): Promise<CreatedShareLink> {
    return createShareLink(this.sql, scope, { ...body, projectId });
  }

  @Requires("project:manage")
  @Delete(":shareId")
  revoke(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("shareId", UuidPipe) shareId: string,
  ): Promise<ShareLink> {
    return revokeShareLink(this.sql, scope, { projectId, shareId });
  }
}
