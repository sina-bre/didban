import {
  type CreatedUser,
  type CreateOwnerRequest,
  createOwnerRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createOwnerAsPlatformAdmin } from "./create-user.js";

/** Platform admins give an organization an owner (spec §11, ADR 0024). */
@Controller("admin/organizations/:organizationId/owners")
export class AdminOwnersController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("platform")
  @Post()
  create(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(createOwnerRequestSchema)) body: CreateOwnerRequest,
  ): Promise<CreatedUser> {
    return createOwnerAsPlatformAdmin(this.sql, scope, { ...body, organizationId });
  }
}
