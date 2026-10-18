import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { UuidPipe } from "../../http/uuid-pipe.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { exportCsv } from "./export-csv.js";
import { StatsGate } from "./stats-gate.js";

// `GET …/stats/export.csv?report=…`: a download, never cached, under the per-project semaphore.
// The raw query is validated in exportCsv with the chosen report's own schema.
@Controller("projects/:projectId/stats")
export class ExportController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly gate: StatsGate,
  ) {}

  @Requires("project:view")
  @Get("export.csv")
  async export(
    @CurrentScope() scope: AccessScope,
    @Param("projectId", UuidPipe) projectId: string,
    @Query() raw: Record<string, unknown>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const work = () => exportCsv(this.sql, scope, { projectId, raw });
    const { filename, body } = await this.gate.run(projectId, null, work);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${filename}"`);
    reply.header("cache-control", "no-store");
    return body;
  }
}
