import { Module } from "@nestjs/common";
import { JobRunner } from "./job-runner.js";

@Module({ providers: [JobRunner], exports: [JobRunner] })
export class JobsModule {}
