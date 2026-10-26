import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module.js";
import { GoalsController } from "./goals.controller.js";

@Module({ imports: [AnalyticsModule], controllers: [GoalsController] })
export class GoalsModule {}
