import { Module } from "@nestjs/common";
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
  providers: [{ provide: StatsGate, useFactory: () => new StatsGate() }],
  // Goals clear a project's cached reports when a goal changes.
  exports: [StatsGate],
})
export class AnalyticsModule {}
