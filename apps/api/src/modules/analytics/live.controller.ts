import {
  type DataHealthResponse,
  type LiveQuery,
  liveQuerySchema,
  type RealtimeResponse,
} from "@didban/contracts";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { RecentRejections } from "../diagnostics/recent-rejections.js";
import { getDataHealth } from "./data-health.js";
import { getRealtime } from "./realtime.js";
import { StatsGate } from "./stats-gate.js";

// Fixed windows ending now. Realtime is never cached (spec §10); data health uses the 15 s cache.
@Controller("projects/:projectId/stats")
export class LiveController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
    private readonly recent: RecentRejections,
  ) {}

  @Requires("project:view")
  @Get("realtime")
  realtime(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(liveQuerySchema)) query: LiveQuery,
  ): Promise<RealtimeResponse> {
    return this.gate.run(projectId, null, () => getRealtime(this.sql, scope, { projectId, query }));
  }

  @Requires("project:view")
  @Get("data-health")
  dataHealth(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(liveQuerySchema)) query: LiveQuery,
  ): Promise<DataHealthResponse> {
    const work = () => getDataHealth(this.sql, scope, { projectId, query, recent: this.recent });
    return this.gate.run(projectId, `data-health|${query.environmentId ?? "all"}`, work);
  }
}
