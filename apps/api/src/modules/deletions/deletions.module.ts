import { Module } from "@nestjs/common";
import { DeletionsController } from "./deletions.controller.js";

@Module({ controllers: [DeletionsController] })
export class DeletionsModule {}
