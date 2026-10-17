import {
  type ApiKeyListResponse,
  type CreateApiKeyRequest,
  type CreatedApiKey,
  createApiKeyRequestSchema,
} from "@didban/contracts";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { createApiKey, listApiKeys, revokeApiKey } from "./api-keys.js";

/** Management of write keys. A write key itself never authenticates here (spec §11). */
@Controller("projects/:projectId")
export class ApiKeysController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("project:manage")
  @Get("keys")
  list(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
  ): Promise<ApiKeyListResponse> {
    return listApiKeys(this.sql, scope, projectId);
  }

  @Requires("project:manage")
  @Post("environments/:environmentId/keys")
  create(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("environmentId", UuidPipe) environmentId: string,
    @Body(new ZodPipe(createApiKeyRequestSchema)) body: CreateApiKeyRequest,
  ): Promise<CreatedApiKey> {
    return createApiKey(this.sql, scope, { projectId, environmentId, kind: body.kind });
  }

  @Requires("project:manage")
  @Delete("keys/:keyId")
  @HttpCode(204)
  async revoke(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Param("keyId", UuidPipe) keyId: string,
  ): Promise<void> {
    await revokeApiKey(this.sql, scope, { projectId, keyId });
  }
}
