import { Module } from "@nestjs/common";
import { EventWriter } from "./event-writer.js";

// Owns the `events`, `visits` and `pages_seen` writes. `ingestion` imports this; never the reverse.
@Module({ providers: [EventWriter], exports: [EventWriter] })
export class EventsModule {}
