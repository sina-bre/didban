import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller.js";

/** Read-only reports (spec §10). Never imported by ingestion; never writes. */
@Module({ controllers: [AnalyticsController] })
export class AnalyticsModule {}
