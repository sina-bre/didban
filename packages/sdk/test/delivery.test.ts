import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setDocumentProperty, setup, stubBeacon, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(cleanup);

const noPageviews = { autoCapture: { pageviews: false } };

describe("transport", () => {
  it("sends a CORS-simple text/plain POST with the key in the body, keepalive, no cookies", async () => {
    const { sent } = stubFetch();
    setup();
    await idle();
    const [batch] = sent;
    expect(batch?.url).toBe("https://collector.example/api/v1/ingest/batch");
    expect(batch?.init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      keepalive: true,
    });
    expect(batch?.body).toMatchObject({
      schemaVersion: 1,
      writeKey: expect.stringMatching(/^wk_/),
    });
  });

  it("accepts a relative proxy endpoint", async () => {
    const { sent } = stubFetch();
    setup({ endpoint: "/a/e/" });
    await idle();
    expect(sent[0]?.url).toBe("/a/e/api/v1/ingest/batch");
  });

  it("does no network before idle", async () => {
    const { sent } = stubFetch();
    setup().track("early");
    expect(sent).toHaveLength(0);
    await idle();
    expect(sent).toHaveLength(1);
  });
});

describe("batching", () => {
  it("flushes on the interval and when a batch is full", async () => {
    const { sent, events } = stubFetch();
    const analytics = setup({ ...noPageviews, maxBatchSize: 3, flushIntervalMs: 5000 });
    await idle();
    analytics.track("a");
    await vi.advanceTimersByTimeAsync(4000);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(1);
    for (const name of ["b", "c", "d"]) analytics.track(name);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);
    expect(events().map((e) => e.name)).toEqual(["a", "b", "c", "d"]);
  });

  it("flush() sends everything at once in batches of maxBatchSize", async () => {
    const { sent } = stubFetch();
    const analytics = setup({ ...noPageviews, maxBatchSize: 2 });
    for (let i = 0; i < 5; i++) analytics.track(`e${i}`);
    await analytics.flush();
    expect(sent.map((s) => s.body.events.length)).toEqual([2, 2, 1]);
  });

  it("drops the oldest events when the queue overflows and reports it", async () => {
    const onError = vi.fn();
    const { events } = stubFetch();
    const analytics = setup({ ...noPageviews, maxQueueSize: 3, requireConsent: true, onError });
    await idle();
    for (let i = 0; i < 5; i++) analytics.track(`e${i}`);
    analytics.setConsent("granted");
    await analytics.flush();
    expect(events().map((e) => e.name)).toEqual(["e2", "e3", "e4"]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "QUEUE_OVERFLOW" }));
  });
});

describe("retries", () => {
  it("retries network errors and 5xx with backoff, recomputing sentAt", async () => {
    const { sent } = stubFetch("network-error", { status: 503 }, { status: 200 });
    setup();
    await idle();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((s) => s.body.sentAt)).size).toBe(3);
    expect(new Set(sent.map((s) => s.body.events[0]?.eventId)).size).toBe(1);
  });

  it("gives up after maxRetries", async () => {
    const onError = vi.fn();
    const { sent } = stubFetch(...Array(10).fill({ status: 500 }));
    setup({ maxRetries: 2, onError });
    await idle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(3);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "RETRIES_EXHAUSTED" }));
  });
});

describe("responses that change the retry plan", () => {
  it("does not retry non-retryable codes", async () => {
    const onError = vi.fn();
    const body = { error: { code: "ORIGIN_NOT_ALLOWED", message: "x", requestId: "r" } };
    const { sent } = stubFetch({ status: 403, body });
    setup({ onError });
    await idle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "ORIGIN_NOT_ALLOWED" }));
  });

  it("waits for Retry-After on 429", async () => {
    const body = { error: { code: "RATE_LIMITED", message: "x", requestId: "r" } };
    const { sent } = stubFetch({ status: 429, body, headers: { "Retry-After": "20" } });
    setup();
    await idle();
    await vi.advanceTimersByTimeAsync(19_000);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(2);
  });

  it("halves a batch once on 413, then drops", async () => {
    const onError = vi.fn();
    const { sent } = stubFetch({ status: 413 }, { status: 200 }, { status: 413 });
    const analytics = setup({ ...noPageviews, onError });
    for (let i = 0; i < 4; i++) analytics.track(`e${i}`);
    await analytics.flush();
    expect(sent.map((s) => s.body.events.length)).toEqual([4, 2, 2]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
  });
});

describe("page hide", () => {
  it("sends queued events with sendBeacon when the page is hidden", async () => {
    stubFetch();
    const beacons = stubBeacon();
    const analytics = setup(noPageviews);
    await idle();
    analytics.track("leaving");
    setDocumentProperty("visibilityState", "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    setDocumentProperty("visibilityState", "visible");
    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.body.events.map((e) => e.name)).toEqual(["leaving"]);
  });

  it("splits beacons to stay under 60 KB", async () => {
    stubFetch();
    const beacons = stubBeacon();
    const analytics = setup({ ...noPageviews, maxBatchSize: 50, flushIntervalMs: 60_000 });
    await idle();
    // 30 events of ~5 KB each: about 150 KB, fewer than maxBatchSize, so only size splits them.
    const props = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`p${i}`, "x".repeat(250)]),
    );
    for (let i = 0; i < 30; i++) analytics.track("big", props);
    window.dispatchEvent(new Event("pagehide"));
    expect(beacons.length).toBeGreaterThanOrEqual(3);
    for (const call of beacons) expect(JSON.stringify(call.body).length).toBeLessThan(60 * 1024);
    expect(beacons.flatMap((b) => b.body.events)).toHaveLength(30);
  });
});
