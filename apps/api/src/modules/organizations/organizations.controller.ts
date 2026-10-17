import {
  type ChangeMemberRoleRequest,
  changeMemberRoleRequestSchema,
  type OrganizationListResponse,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { changeMemberRole } from "./change-member-role.js";
import { listOrganizations } from "./list-organizations.js";
import { removeMember } from "./remove-member.js";

@Controller("organizations")
export class OrganizationsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("self")
  @Get()
  list(@CurrentScope() scope: AccessScope): Promise<OrganizationListResponse> {
    return listOrganizations(this.sql, scope);
  }

  @Requires("org:roles")
  @Patch(":organizationId/members/:userId")
  @HttpCode(204)
  async changeRole(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Param("userId", UuidPipe) userId: string,
    @Body(new ZodPipe(changeMemberRoleRequestSchema)) body: ChangeMemberRoleRequest,
  ): Promise<void> {
    await changeMemberRole(this.sql, {
      actorUserId: scope.userId,
      organizationId,
      userId,
      role: body.role,
    });
  }

  @Requires("org:roles")
  @Delete(":organizationId/members/:userId")
  @HttpCode(204)
  async remove(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Param("userId", UuidPipe) userId: string,
  ): Promise<void> {
    await removeMember(this.sql, { actorUserId: scope.userId, organizationId, userId });
  }
}
