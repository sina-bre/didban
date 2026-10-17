import {
  type CreatedInvite,
  type CreateInviteRequest,
  createInviteRequestSchema,
  type InviteListResponse,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createInvite, listInvites, revokeInvite } from "./organization-invites.js";

@Controller("organizations/:organizationId/invites")
export class InvitesController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Requires("org:invite")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
  ): Promise<InviteListResponse> {
    return listInvites(this.sql, scope, organizationId);
  }

  @Requires("org:invite")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(createInviteRequestSchema)) body: CreateInviteRequest,
  ): Promise<CreatedInvite> {
    const publicOrigin = this.env.PUBLIC_ORIGIN;
    return createInvite(this.sql, scope, { ...body, organizationId, publicOrigin });
  }

  @Requires("org:invite")
  @Delete(":inviteId")
  @HttpCode(204)
  async revoke(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Param("inviteId", UuidPipe) inviteId: string,
  ): Promise<void> {
    await revokeInvite(this.sql, scope, { organizationId, inviteId });
  }
}
