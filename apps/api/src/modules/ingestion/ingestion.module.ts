import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module.js";
import { DailySalt } from "./daily-salt.js";
import { EnrichBatch } from "./enrich/enrich-batch.js";
import { GeoLookup } from "./enrich/geo-lookup.js";
import { IdentifyBatch } from "./identify-batch.js";
import { IngestBatch } from "./ingest-batch.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { IngestRateLimiter } from "./ingest-rate-limiter.js";
import { IngestionController } from "./ingestion.controller.js";
import { IngestionFlusher } from "./ingestion-flusher.js";
import { KeyUsage } from "./key-usage.js";
import { PrepareBatch } from "./prepare-batch.js";
import { WriteKeyResolver } from "./resolve-write-key.js";

// The in-memory pieces take an optional clock, so they are built with factories (tests pass fakes).
@Module({
  imports: [EventsModule],
  controllers: [IngestionController],
  providers: [
    IngestBatch,
    PrepareBatch,
    EnrichBatch,
    IdentifyBatch,
    DailySalt,
    GeoLookup,
    WriteKeyResolver,
    IngestionFlusher,
    { provide: KeyUsage, useFactory: () => new KeyUsage() },
    { provide: IngestRateLimiter, useFactory: () => new IngestRateLimiter() },
    { provide: IngestDiagnostics, useFactory: () => new IngestDiagnostics() },
  ],
})
export class IngestionModule {}
