import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller.js";
import { ExportController } from "./export.controller.js";
import { LiveController } from "./live.controller.js";
import { PagesController } from "./pages.controller.js";
import { ReportsController } from "./reports.controller.js";
import { StatsGate } from "./stats-gate.js";

/** Read-only reports (spec §10). Never imported by ingestion; never writes. */
@Module({
  controllers: [
    AnalyticsController,
    PagesController,
    ReportsController,
    LiveController,
    ExportController,
  ],
  providers: [{ provide: StatsGate, useFactory: () => new StatsGate() }],
})
export class AnalyticsModule {}
