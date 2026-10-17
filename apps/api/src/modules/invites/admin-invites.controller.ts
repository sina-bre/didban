import {
  type CreatedInvite,
  type CreateOwnerInviteRequest,
  createOwnerInviteRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createOwnerInvite } from "./platform-invite.js";

/** Platform admins invite an organization's owner (spec §11). */
@Controller("admin/organizations/:organizationId/invites")
export class AdminInvitesController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Requires("platform")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(createOwnerInviteRequestSchema)) body: CreateOwnerInviteRequest,
  ): Promise<CreatedInvite> {
    const publicOrigin = this.env.PUBLIC_ORIGIN;
    return createOwnerInvite(this.sql, scope, { ...body, organizationId, publicOrigin });
  }
}
