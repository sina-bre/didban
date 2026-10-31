import { Global, Module } from "@nestjs/common";
import { WriteKeyCache } from "../key-cache/write-key-cache.js";
import { RecentRejections } from "./recent-rejections.js";

/**
 * Process-wide state shared across modules: rejected batches (ingestion writes, analytics reads)
 * and the write-key cache (ingestion reads, environment changes forget entries).
 */
@Global()
@Module({
  providers: [
    { provide: RecentRejections, useFactory: () => new RecentRejections() },
    { provide: WriteKeyCache, useFactory: () => new WriteKeyCache() },
  ],
  exports: [RecentRejections, WriteKeyCache],
})
export class DiagnosticsModule {}
