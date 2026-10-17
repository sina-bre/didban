import { Module } from "@nestjs/common";
import { EnvironmentsController } from "./environments.controller.js";

@Module({ controllers: [EnvironmentsController] })
export class EnvironmentsModule {}
