import { type AuditLogQuery, type AuditLogResponse, auditLogQuerySchema } from "@didban/contracts";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { listAuditLog } from "./list-audit-log.js";

/** Read-only by design: there is no route that changes or deletes audit rows (spec §11). */
@Controller("organizations/:organizationId/audit-log")
export class AuditController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Requires("org:audit")
  @Get()
  list(
    @CurrentScope() scope: AccessScope,
    @Param("organizationId", UuidPipe) organizationId: string,
    @Query(new ZodPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ): Promise<AuditLogResponse> {
    return listAuditLog(this.sql, scope, { ...query, organizationId });
  }
}
