import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller.js";
import { PagesController } from "./pages.controller.js";
import { ReportsController } from "./reports.controller.js";

/** Read-only reports (spec §10). Never imported by ingestion; never writes. */
@Module({ controllers: [AnalyticsController, PagesController, ReportsController] })
export class AnalyticsModule {}
