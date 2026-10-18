import { vi } from "vitest";
import { createAnalytics } from "../src/index.js";
import type { Analytics, AnalyticsOptions, SdkEvent } from "../src/types.js";

export interface SentBatch {
  url: string;
  body: { sentAt: string; writeKey: string; events: SdkEvent[]; [key: string]: unknown };
  init: RequestInit;
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | "network-error";

/** Stubs `fetch`; replies are used in order, then `{ status: 200 }` forever. */
export function stubFetch(...replies: Reply[]) {
  const sent: SentBatch[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)), init });
    const reply = replies.shift() ?? { status: 200 };
    if (reply === "network-error") throw new TypeError("Failed to fetch");
    const body = reply.body ?? { accepted: 1, duplicates: 0, rejected: [], requestId: "r" };
    return new Response(JSON.stringify(body), { status: reply.status, headers: reply.headers });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { sent, fetchMock, events: () => sent.flatMap((s) => s.body.events) };
}

export function stubBeacon(result = true) {
  const calls: { url: string; body: { events: SdkEvent[] } }[] = [];
  const fn = vi.fn((url: string, data: string) => {
    calls.push({ url, body: JSON.parse(data) });
    return result;
  });
  Object.defineProperty(navigator, "sendBeacon", { value: fn, configurable: true });
  return calls;
}

export function setDocumentProperty(name: string, value: unknown) {
  Object.defineProperty(document, name, { value, configurable: true });
}

const live: Analytics[] = [];
let counter = 0;

/** A fresh instance per call (unique write key, so the singleton registry never interferes). */
export function setup(options: Partial<AnalyticsOptions> = {}): Analytics {
  counter += 1;
  const analytics = createAnalytics({
    endpoint: "https://collector.example",
    writeKey: `wk_test_${counter}`,
    ...options,
  });
  live.push(analytics);
  return analytics;
}

/** Runs the idle start (setTimeout fallback in jsdom) and settles pending sends. */
export async function idle(ms = 10) {
  await vi.advanceTimersByTimeAsync(ms);
}

export function cleanup() {
  for (const analytics of live.splice(0)) analytics.shutdown();
  window.history.replaceState(null, "", "/start");
  document.title = "Start";
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
}
