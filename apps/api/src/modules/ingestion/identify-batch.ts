import { LIMITS } from "@didban/contracts";
import { Injectable } from "@nestjs/common";
import { anonymousVisitorId, cookielessVisitorId, userVisitorId } from "../../domain/visitor-id.js";
import { DailySalt } from "./daily-salt.js";
import type { EnrichedEvent } from "./enrich/enrich-batch.js";
import type { Client } from "./enrich/request-traits.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { ingestError } from "./ingest-error.js";
import { plainIp } from "./ingest-settings.js";
import type { Rejection } from "./validate-batch.js";
import type { ResolvedKey } from "../key-cache/write-key-cache.js";

// Spec §7 step 7 + §4 identity modes + §6.2 server-key rules. Browser events: `persistent` mode
// uses the SDK's `anonymousId` (cookieless hash when it is missing, e.g. before consent).
// Server events need `userId` or `anonymousId`; an `anonymousId` joins the browser visitor.
// With `allow_identify` off, user IDs are not stored and browser identify events are dropped.

export type IdentifiedEvent = EnrichedEvent & { visitorId: Buffer };
export type IdentifiedBatch = {
  events: IdentifiedEvent[];
  rejected: Rejection[];
  filtered: number;
};

@Injectable()
export class IdentifyBatch {
  constructor(
    private readonly salts: DailySalt,
    private readonly diagnostics: IngestDiagnostics,
  ) {}

  async execute(
    key: ResolvedKey,
    events: EnrichedEvent[],
    client: Client,
  ): Promise<IdentifiedBatch> {
    const isBrowser = key.kind === "write_browser";
    const result: IdentifiedBatch = { events: [], rejected: [], filtered: 0 };
    let cookieless: Buffer | undefined;
    for (const event of events) {
      if (isBrowser && !key.settings.allowIdentify && event.type === "identify") {
        this.diagnostics.record(key, "IDENTIFY_DISABLED");
        result.filtered += 1;
        continue;
      }
      let visitorId = isBrowser ? this.browserVisitor(key, event) : serverVisitor(key, event);
      if (isBrowser && !visitorId) {
        cookieless ??= await this.cookielessVisitor(key, client);
        visitorId = cookieless;
      }
      if (!visitorId) {
        this.diagnostics.record(key, "INVALID_EVENT");
        result.rejected.push({ index: event.index, code: "INVALID_EVENT", path: "userId" });
        continue;
      }
      result.events.push({ ...event, userId: this.storedUserId(key, event), visitorId });
    }
    if (isBrowser) this.checkVisitorCount(key, result.events);
    return result;
  }

  private browserVisitor(key: ResolvedKey, event: EnrichedEvent): Buffer | null {
    if (key.settings.identityMode !== "persistent" || !event.anonymousId) return null;
    return anonymousVisitorId(key.projectId, event.anonymousId);
  }

  private async cookielessVisitor(key: ResolvedKey, client: Client): Promise<Buffer> {
    const salt = await this.salts.forDay(new Date());
    const userAgent = client.userAgent ?? ""; // never empty here: no UA is filtered as a bot
    return cookielessVisitorId(salt, key.projectId, { ip: plainIp(client.ip), userAgent });
  }

  private storedUserId(key: ResolvedKey, event: EnrichedEvent): string | null {
    if (!event.userId || key.settings.allowIdentify) return event.userId;
    this.diagnostics.record(key, "IDENTIFY_DISABLED");
    return null;
  }

  private checkVisitorCount(key: ResolvedKey, events: IdentifiedEvent[]): void {
    const distinct = new Set(events.map((event) => event.visitorId.toString("hex")));
    if (distinct.size <= LIMITS.maxVisitorsPerBrowserBatch) return;
    this.diagnostics.record(key, "TOO_MANY_VISITORS_IN_BATCH");
    throw ingestError("TOO_MANY_VISITORS_IN_BATCH", "Too many distinct visitors in one batch");
  }
}

function serverVisitor(key: ResolvedKey, event: EnrichedEvent): Buffer | null {
  if (event.anonymousId) return anonymousVisitorId(key.projectId, event.anonymousId);
  if (event.userId) return userVisitorId(key.projectId, event.userId);
  return null;
}
