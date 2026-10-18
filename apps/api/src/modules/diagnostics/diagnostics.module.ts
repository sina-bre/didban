import { Global, Module } from "@nestjs/common";
import { RecentRejections } from "./recent-rejections.js";

/** Process-wide diagnostics shared by ingestion (writes) and analytics (reads). */
@Global()
@Module({
  providers: [{ provide: RecentRejections, useFactory: () => new RecentRejections() }],
  exports: [RecentRejections],
})
export class DiagnosticsModule {}
