import { EVENT_SOURCES } from "@didban/contracts";
import { Injectable } from "@nestjs/common";
import { EventWriter } from "../events/event-writer.js";
import { EnrichBatch } from "./enrich/enrich-batch.js";
import { IdentifyBatch } from "./identify-batch.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { ingestError } from "./ingest-error.js";
import { type IngestRequest, PrepareBatch } from "./prepare-batch.js";
import { toNewEvent } from "./to-new-event.js";
import type { Rejection } from "./validate-batch.js";

// Spec §7 in order: steps 1–5 (prepare), 6 (enrich), 7 (identify), 8 (write, one transaction).
// Filtered events (bots, internal traffic, localhost, identify off) count as accepted (§6.4).
// A 200 is sent only after the commit. Lock waits, timeouts and a lost database become 503 so
// the SDK retries; the retry is deduplicated by event ID.

export type IngestResult = { accepted: number; duplicates: number; rejected: Rejection[] };
export type IngestInput = IngestRequest & { userAgent: string | undefined };

const RETRYABLE_PG_CODES = new Set(["40001", "40P01", "55P03", "57014", "53300", "57P01", "08006"]);

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== "string") return false;
  return RETRYABLE_PG_CODES.has(code) || code.startsWith("CONNECT") || code.startsWith("ECONN");
}

@Injectable()
export class IngestBatch {
  constructor(
    private readonly prepare: PrepareBatch,
    private readonly enrich: EnrichBatch,
    private readonly identify: IdentifyBatch,
    private readonly writer: EventWriter,
    private readonly diagnostics: IngestDiagnostics,
  ) {}

  async execute(input: IngestInput): Promise<IngestResult> {
    const batch = await this.prepare.execute(input);
    const { key } = batch;
    const client = { ip: input.ip, userAgent: input.userAgent };
    const enriched = this.enrich.execute(batch, client);
    const identified = await this.identify.execute(key, enriched.events, client);
    const source = key.kind === "write_browser" ? EVENT_SOURCES.browser : EVENT_SOURCES.server;
    const target = { ...key, source, sessionTimeoutMinutes: key.settings.sessionTimeoutMinutes };
    try {
      const written = await this.writer.write(
        target,
        identified.events.map(toNewEvent),
        new Date(),
      );
      if (written.pagesOverflowed > 0)
        this.diagnostics.record(key, "PAGES_SEEN_OVERFLOW", written.pagesOverflowed);
      if (written.duplicates > 0)
        this.diagnostics.record(key, "DUPLICATE_EVENT", written.duplicates);
      return {
        accepted: written.inserted + enriched.filtered + identified.filtered,
        duplicates: written.duplicates,
        rejected: [...batch.rejected, ...identified.rejected].sort((a, b) => a.index - b.index),
      };
    } catch (error) {
      if (!isRetryable(error)) throw error;
      this.diagnostics.record(key, "SERVICE_UNAVAILABLE");
      throw ingestError("SERVICE_UNAVAILABLE", "Event storage is temporarily unavailable");
    }
  }
}
