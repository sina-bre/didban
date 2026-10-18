import type { AnalyticsEvent } from "@didban/contracts";
import { Injectable } from "@nestjs/common";
import { IngestDiagnostics } from "../ingest-diagnostics.js";
import type { PreparedBatch } from "../prepare-batch.js";
import type { ValidEvent } from "../validate-batch.js";
import { enrichEvent, type PageFields } from "./enrich-event.js";
import { GeoLookup } from "./geo-lookup.js";
import { browserTraits, type Client, type RequestTraits, serverTraits } from "./request-traits.js";

// Spec §7 step 6. Bot, internal-traffic and localhost events are dropped silently: the response
// will count them as accepted (§6.4), Data Health sees the diagnostics code. Raw IP and UA never
// leave this step except as `client`, which identity (Stage 3c) needs for the daily hash.

export type EnrichedEvent = PageFields &
  Traits & {
    index: number;
    eventId: string;
    type: AnalyticsEvent["type"];
    name: string | null;
    title: string | null;
    anonymousId: string | null;
    occurredAt: Date;
  };
export type EnrichedBatch = { events: EnrichedEvent[]; filtered: number };

type Traits = Omit<RequestTraits, "drop">;

function toEnriched(valid: ValidEvent, fields: PageFields, traits: Traits): EnrichedEvent {
  const { event } = valid;
  return {
    ...fields,
    ...traits,
    index: valid.index,
    eventId: event.eventId,
    type: event.type,
    name: event.type === "track" ? event.name : null,
    title: event.title ?? null,
    anonymousId: event.anonymousId ?? null,
    occurredAt: valid.occurredAt,
  };
}

@Injectable()
export class EnrichBatch {
  constructor(
    private readonly geo: GeoLookup,
    private readonly diagnostics: IngestDiagnostics,
  ) {}

  execute(batch: PreparedBatch, client: Client): EnrichedBatch {
    const { key } = batch;
    const isBrowser = key.kind === "write_browser";
    const input = { client, context: batch.envelope.context, settings: key.settings };
    const { drop, ...traits } = isBrowser ? browserTraits(input, this.geo) : serverTraits();
    if (drop) {
      this.diagnostics.record(key, drop, batch.events.length);
      return { events: [], filtered: batch.events.length };
    }
    const events: EnrichedEvent[] = [];
    for (const valid of batch.events) {
      const result = enrichEvent(valid, key.settings, isBrowser);
      if ("localhost" in result) {
        this.diagnostics.record(key, "LOCALHOST_EXCLUDED");
        continue;
      }
      for (const code of result.drops) this.diagnostics.record(key, code);
      events.push(toEnriched(valid, result.fields, traits));
    }
    return { events, filtered: batch.events.length - events.length };
  }
}
