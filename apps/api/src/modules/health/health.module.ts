import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { ShutdownState } from "./shutdown-state.js";

@Module({ controllers: [HealthController], providers: [ShutdownState] })
export class HealthModule {}
