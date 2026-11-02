import { Module } from "@nestjs/common";
import { Metrics } from "../metrics/metrics.js";
import { AnalyticsController } from "./analytics.controller.js";
import { ExportController } from "./export.controller.js";
import { LiveController } from "./live.controller.js";
import { PagesController } from "./pages.controller.js";
import { ReportsController } from "./reports.controller.js";
import { ShareViewController } from "./share-view.controller.js";
import { StatsGate } from "./stats-gate.js";

/** Read-only reports (spec §10). Never imported by ingestion; never writes. */
@Module({
  controllers: [
    AnalyticsController,
    PagesController,
    ReportsController,
    LiveController,
    ExportController,
    ShareViewController,
  ],
  providers: [
    {
      provide: StatsGate,
      useFactory: (metrics: Metrics) =>
        new StatsGate(Date.now, () => metrics.rateLimited.inc({ bucket: "stats_project" })),
      inject: [Metrics],
    },
  ],
  // Goals clear a project's cached reports when a goal changes.
  exports: [StatsGate],
})
export class AnalyticsModule {}
