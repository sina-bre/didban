import {
  type CreateOrganizationRequest,
  createOrganizationRequestSchema,
  type SetOrganizationSuspendedRequest,
  setOrganizationSuspendedRequestSchema,
} from "@didban/contracts";
import { Body, Controller, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createOrganization, setOrganizationSuspended } from "./platform-organizations.js";

/** Platform-admin routes (spec §11). Non-admins get 403: the admin area itself is not a secret. */
@Controller("admin/organizations")
export class AdminOrganizationsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("platform")
  @Post()
  @HttpCode(201)
  create(
    @CurrentScope() scope: AccessScope,
    @Body(new ZodPipe(createOrganizationRequestSchema)) body: CreateOrganizationRequest,
  ) {
    return createOrganization(this.sql, scope, body.name);
  }

  @Requires("platform")
  @Patch(":organizationId")
  @HttpCode(204)
  async setSuspended(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(setOrganizationSuspendedRequestSchema)) body: SetOrganizationSuspendedRequest,
  ): Promise<void> {
    await setOrganizationSuspended(this.sql, scope, organizationId, body.suspended);
  }
}
