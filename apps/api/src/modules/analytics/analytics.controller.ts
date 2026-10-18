import {
  type OverviewResponse,
  type StatsQuery,
  statsQuerySchema,
  type TimeseriesResponse,
} from "@didban/contracts";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { getOverview } from "./overview.js";
import { queryKey, StatsGate } from "./stats-gate.js";
import { getTimeseries } from "./timeseries.js";

// Spec §10 `/projects/:projectId/stats/*`: any role that can see the project (`project:view`).
@Controller("projects/:projectId/stats")
export class AnalyticsController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
  ) {}

  @Requires("project:view")
  @Get("overview")
  overview(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(statsQuerySchema)) query: StatsQuery,
  ): Promise<OverviewResponse> {
    const work = () => getOverview(this.sql, scope, { projectId, query });
    return this.gate.run(projectId, queryKey("overview", query), work);
  }

  @Requires("project:view")
  @Get("timeseries")
  timeseries(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(statsQuerySchema)) query: StatsQuery,
  ): Promise<TimeseriesResponse> {
    const work = () => getTimeseries(this.sql, scope, { projectId, query });
    return this.gate.run(projectId, queryKey("timeseries", query), work);
  }
}
