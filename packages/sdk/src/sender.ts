import type { Config } from "./config.js";
import { MAX_BEACON_BYTES } from "./limits.js";
import { buildPayload } from "./payload.js";
import type { Report } from "./report.js";
import { backoffDelay, classify, type Outcome } from "./retry.js";
import type { Scope } from "./scope.js";
import { beacon, post } from "./transport.js";
import type { SdkEvent } from "./types.js";

export interface Sender {
  /** Delivers one batch with retries; resolves when it is sent or given up. Never rejects. */
  send(batch: SdkEvent[]): Promise<void>;
  /** Sends events with sendBeacon in chunks under the beacon size limit. */
  beacon(events: SdkEvent[]): void;
  /** The batch currently waiting for a retry (handed to the beacon on page hide). */
  waiting(): SdkEvent[];
}

const encoder = new TextEncoder();
const BEACON_BUDGET = MAX_BEACON_BYTES - 2048; // room for the envelope around the events

export function chunkForBeacon(events: SdkEvent[], maxEvents: number): SdkEvent[][] {
  const chunks: SdkEvent[][] = [];
  let current: SdkEvent[] = [];
  let bytes = 0;
  for (const event of events) {
    const size = encoder.encode(JSON.stringify(event)).length + 1;
    if (current.length > 0 && (bytes + size > BEACON_BUDGET || current.length >= maxEvents)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(event);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function createSender(config: Config, scope: Scope, report: Report): Sender {
  let waiting: SdkEvent[] = [];
  const drop = (code: string, batch: SdkEvent[]) =>
    report(code, `dropped ${batch.length} event(s)`);

  /** `false` = the instance shut down while waiting (the beacon already took the batch). */
  async function wait(batch: SdkEvent[], ms: number): Promise<boolean> {
    waiting = batch;
    const slept = await scope.sleep(ms);
    waiting = [];
    return slept;
  }

  /** Spec §6.5: on 413 halve the batch once, then drop. */
  async function split(batch: SdkEvent[], halved: boolean): Promise<void> {
    if (halved || batch.length < 2) return drop("PAYLOAD_TOO_LARGE", batch);
    const middle = Math.ceil(batch.length / 2);
    await send(batch.slice(0, middle), true);
    await send(batch.slice(middle), true);
  }

  function settle(batch: SdkEvent[], outcome: Outcome, rejected: number, halved: boolean) {
    if (outcome.kind === "split") return split(batch, halved);
    if (outcome.kind !== "ok") {
      drop(outcome.kind === "drop" ? outcome.code : "RETRIES_EXHAUSTED", batch);
    } else if (rejected > 0) {
      report("EVENTS_REJECTED", `server rejected ${rejected} event(s)`);
    }
  }

  async function send(batch: SdkEvent[], halved = false): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      const body = buildPayload(config.writeKey, batch);
      const result = await post(config.url, body, config.requestTimeoutMs);
      const outcome = classify(result);
      if (outcome.kind !== "retry" || attempt >= config.maxRetries) {
        return settle(batch, outcome, result?.rejected ?? 0, halved);
      }
      if (!(await wait(batch, outcome.delayMs ?? backoffDelay(attempt)))) return;
    }
  }

  return {
    send: (batch) => send(batch),
    beacon(events) {
      for (const chunk of chunkForBeacon(events, config.maxBatchSize)) {
        beacon(config.url, buildPayload(config.writeKey, chunk));
      }
    },
    waiting: () => waiting,
  };
}
