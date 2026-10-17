import { Module } from "@nestjs/common";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { IngestRateLimiter } from "./ingest-rate-limiter.js";
import { IngestionController } from "./ingestion.controller.js";
import { IngestionFlusher } from "./ingestion-flusher.js";
import { KeyUsage } from "./key-usage.js";
import { PrepareBatch } from "./prepare-batch.js";
import { WriteKeyResolver } from "./resolve-write-key.js";
import { WriteKeyCache } from "./write-key-cache.js";

// The in-memory pieces take an optional clock, so they are built with factories (tests pass fakes).
@Module({
  controllers: [IngestionController],
  providers: [
    PrepareBatch,
    WriteKeyResolver,
    IngestionFlusher,
    { provide: WriteKeyCache, useFactory: () => new WriteKeyCache() },
    { provide: KeyUsage, useFactory: () => new KeyUsage() },
    { provide: IngestRateLimiter, useFactory: () => new IngestRateLimiter() },
    { provide: IngestDiagnostics, useFactory: () => new IngestDiagnostics() },
  ],
})
export class IngestionModule {}
