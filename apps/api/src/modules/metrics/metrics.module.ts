import { Global, Inject, Module, type OnModuleInit } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { registerJobGauges } from "./job-gauges.js";
import { MetricsController } from "./metrics.controller.js";
import { Metrics } from "./metrics.js";

/** Spec §15. Global: ingestion, analytics, auth, jobs and the DB pool all report here. */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [{ provide: Metrics, useFactory: () => new Metrics() }],
  exports: [Metrics],
})
export class MetricsModule implements OnModuleInit {
  constructor(
    private readonly metrics: Metrics,
    @Inject(SQL) private readonly sql: Sql,
  ) {}

  onModuleInit(): void {
    registerJobGauges(this.metrics.registry, this.sql);
  }
}
