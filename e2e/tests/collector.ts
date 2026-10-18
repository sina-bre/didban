import { expect } from "@playwright/test";

const COLLECTOR = "http://localhost:5301/__records";

export interface SentEvent {
  type: string;
  name?: string;
  url: string;
  properties: Record<string, unknown>;
}
export interface Recorded {
  forwardedFor: string | null;
  socket: string;
  origin: string | null;
  /** What the real API answered. */
  status: number;
  batch: { writeKey: string; events: SentEvent[] };
}

export async function clearRecords(): Promise<void> {
  await fetch(COLLECTOR, { method: "DELETE" });
}

export async function records(writeKey: string): Promise<Recorded[]> {
  const all = (await (await fetch(COLLECTOR)).json()) as Recorded[];
  return all.filter((r) => r.batch?.writeKey === writeKey);
}

export async function events(writeKey: string): Promise<SentEvent[]> {
  return (await records(writeKey)).flatMap((r) => r.batch.events);
}

/** Page-view paths (path + query) in the order the collector received them. */
export const pagePaths = (list: SentEvent[]) =>
  list.filter((e) => e.type === "page").map((e) => new URL(e.url).pathname + new URL(e.url).search);

/** Waits for the SDK's interval flush (5 s by default) to deliver what `check` expects. */
export async function eventually<T>(read: () => Promise<T>, check: (value: T) => void) {
  await expect(async () => check(await read())).toPass({ timeout: 20_000, intervals: [500] });
}

/** The visitor address forwarded by a same-origin proxy on this machine. */
export const LOOPBACK = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;
