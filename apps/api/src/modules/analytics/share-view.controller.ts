import * as c from "@didban/contracts";
import { Controller, Get, Headers, Inject, Param, Query } from "@nestjs/common";
import type { z } from "zod";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { Public } from "../auth/public.decorator.js";
import { getEvents } from "./events-report.js";
import { getDevices, getGeo } from "./geo-devices.js";
import { getGoalStats } from "./goals-report.js";
import { getOverview } from "./overview.js";
import { getPages } from "./pages.js";
import { resolveShare, shareScope } from "./share-access.js";
import { getSources } from "./sources.js";
import { queryKey, StatsGate } from "./stats-gate.js";
import { getTimeseries } from "./timeseries.js";

// Public share view (spec §11 allowlist "share view"): `X-Share-Token` opens exactly the reports
// in SHARED_REPORTS of one project, read-only, through the same use cases, semaphore and cache.

type Run = (
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: never },
) => Promise<unknown>;
const REPORTS: Record<(typeof c.SHARED_REPORTS)[number], { schema: z.ZodType; run: Run }> = {
  overview: { schema: c.statsQuerySchema, run: getOverview as Run },
  timeseries: { schema: c.statsQuerySchema, run: getTimeseries as Run },
  pages: { schema: c.pagesQuerySchema, run: getPages as Run },
  sources: { schema: c.sourcesQuerySchema, run: getSources as Run },
  geo: { schema: c.geoQuerySchema, run: getGeo as Run },
  devices: { schema: c.devicesQuerySchema, run: getDevices as Run },
  events: { schema: c.eventsQuerySchema, run: getEvents as Run },
  goals: { schema: c.statsQuerySchema, run: getGoalStats as Run },
};

@Controller("share")
export class ShareViewController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
  ) {}

  @Public()
  @Get()
  async info(
    @Headers(c.SHARE_TOKEN_HEADER) token: string | undefined,
  ): Promise<c.SharedProjectResponse> {
    const { projectName, label, timezone } = await resolveShare(this.sql, token);
    return { projectName, label, timezone };
  }

  @Public()
  @Get("stats/:report")
  async report(
    @Headers(c.SHARE_TOKEN_HEADER) token: string | undefined,
    @Param("report") name: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<unknown> {
    const report = Object.hasOwn(REPORTS, name) ? REPORTS[name as keyof typeof REPORTS] : null;
    if (!report) throw notFound();
    const shared = await resolveShare(this.sql, token);
    const parsed = report.schema.safeParse(raw);
    if (!parsed.success) throw new AppError(400, "VALIDATION_FAILED", "Invalid request");
    const query = parsed.data as c.StatsQuery;
    const input = { projectId: shared.projectId, query: query as never };
    const work = () => report.run(this.sql, shareScope(shared), input);
    return this.gate.run(shared.projectId, queryKey(name, query), work);
  }
}
