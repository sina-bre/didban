import {
  type BreakdownResponse,
  type PageDetailQuery,
  type PageDetailResponse,
  type PagesQuery,
  pageDetailQuerySchema,
  pagesQuerySchema,
} from "@didban/contracts";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { getPageDetail } from "./page-detail.js";
import { getPages, type PagesRow } from "./pages.js";
import { queryKey, StatsGate } from "./stats-gate.js";

@Controller("projects/:projectId/stats/pages")
export class PagesController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
  ) {}

  @Requires("project:view")
  @Get()
  pages(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(pagesQuerySchema)) query: PagesQuery,
  ): Promise<BreakdownResponse<PagesRow>> {
    const work = () => getPages(this.sql, scope, { projectId, query });
    return this.gate.run(projectId, queryKey("pages", query), work);
  }

  @Requires("project:view")
  @Get("detail")
  detail(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query(new ZodPipe(pageDetailQuerySchema)) query: PageDetailQuery,
  ): Promise<PageDetailResponse> {
    const work = () => getPageDetail(this.sql, scope, { projectId, query });
    return this.gate.run(projectId, queryKey("pages/detail", query), work);
  }
}
