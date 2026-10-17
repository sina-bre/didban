import {
  type CreatedUser,
  type CreateUserRequest,
  createUserRequestSchema,
  type PasswordResetResponse,
} from "@didban/contracts";
import { Body, Controller, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createUser } from "./create-user.js";
import { resetMemberPassword } from "./reset-password.js";

/** ADR 0024: owners/admins create users; owners reset passwords. No signup, no invites. */
@Controller("organizations/:organizationId")
export class UsersController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("org:users")
  @Post("users")
  create(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Body(new ZodPipe(createUserRequestSchema)) body: CreateUserRequest,
  ): Promise<CreatedUser> {
    return createUser(this.sql, scope, { ...body, organizationId });
  }

  @Requires("org:roles")
  @Post("members/:userId/password-reset")
  @HttpCode(200)
  async resetPassword(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Param("userId", UuidPipe) userId: string,
  ): Promise<PasswordResetResponse> {
    const input = { organizationId, userId };
    return { temporaryPassword: await resetMemberPassword(this.sql, scope, input) };
  }
}
