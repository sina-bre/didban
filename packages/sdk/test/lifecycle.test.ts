import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalytics } from "../src/index.js";
import { cleanup, idle, setDocumentProperty, setup, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  setDocumentProperty("prerendering", false);
});

describe("instances", () => {
  it("returns the same instance for the same endpoint + key and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const options = { endpoint: "https://c.example", writeKey: "wk_dup" };
    const first = createAnalytics(options);
    expect(createAnalytics(options)).toBe(first);
    expect(createAnalytics(options)).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);
    first.shutdown();
    expect(createAnalytics(options)).not.toBe(first);
    createAnalytics(options).shutdown();
  });

  it("never throws: bad options give a no-op instance and onError", async () => {
    const onError = vi.fn();
    const analytics = createAnalytics({ endpoint: "https://c.example", writeKey: "", onError });
    expect(() => analytics.track("x")).not.toThrow();
    await expect(analytics.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_OPTIONS" }));
  });

  it("rejects invalid names and user IDs without throwing", async () => {
    const onError = vi.fn();
    const { events } = stubFetch();
    const analytics = setup({ autoCapture: { pageviews: false }, onError });
    analytics.track("$reserved");
    analytics.track("1bad");
    analytics.identify("x".repeat(129));
    await analytics.flush();
    expect(events()).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(3);
  });
});

describe("beforeSend", () => {
  it("can edit or drop events", async () => {
    const { events } = stubFetch();
    const analytics = setup({
      autoCapture: { pageviews: false },
      beforeSend: (e) => (e.name === "drop_me" ? null : { ...e, properties: { edited: true } }),
    });
    analytics.track("drop_me");
    analytics.track("keep");
    await analytics.flush();
    expect(events().map((e) => [e.name, e.properties])).toEqual([["keep", { edited: true }]]);
  });

  it("throwing drops the event by default and sends it unmodified with failOpen", async () => {
    const onError = vi.fn();
    const { events } = stubFetch();
    const beforeSend = (e: { properties: Record<string, unknown> }) => {
      e.properties.mutated = true;
      throw new Error("hook failed");
    };
    const base = { autoCapture: { pageviews: false }, beforeSend, onError } as const;
    setup(base).track("closed");
    const open = setup({ ...base, failOpen: true });
    open.track("open", { a: 1 });
    await open.flush();
    expect(events().map((e) => [e.name, e.properties])).toEqual([["open", { a: 1 }]]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "BEFORE_SEND_FAILED" }));
  });
});

describe("page lifecycle", () => {
  it("prerendered pages are not counted until activation", async () => {
    setDocumentProperty("prerendering", true);
    const { events } = stubFetch();
    setup();
    await idle(10_000);
    expect(events()).toHaveLength(0);
    setDocumentProperty("prerendering", false);
    document.dispatchEvent(new Event("prerenderingchange"));
    await idle(10_000);
    expect(events().map((e) => e.type)).toEqual(["page"]);
  });

  it("a bfcache restore emits a new page view for the same URL", async () => {
    const { events } = stubFetch();
    setup();
    await idle();
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    await idle(10_000);
    expect(events().map((e) => e.url)).toEqual([
      "https://shop.example/start",
      "https://shop.example/start",
    ]);
  });
});

describe("storage and cleanup", () => {
  it("falls back to memory when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });
    const { events } = stubFetch();
    const analytics = setup({ identity: "persistent", autoCapture: { pageviews: false } });
    analytics.track("a");
    analytics.track("b");
    await analytics.flush();
    const [a, b] = events();
    expect(a?.anonymousId).toBeTruthy();
    expect(b?.anonymousId).toBe(a?.anonymousId);
  });

  it("shutdown removes every listener, timer and history patch", async () => {
    stubFetch();
    const originalPush = history.pushState;
    const added: string[] = [];
    const removed: string[] = [];
    for (const target of [window, document]) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      vi.spyOn(target, "addEventListener").mockImplementation((type, fn, o) => {
        added.push(type);
        add(type, fn, o);
      });
      vi.spyOn(target, "removeEventListener").mockImplementation((type, fn, o) => {
        removed.push(type);
        remove(type, fn, o);
      });
    }
    const analytics = setup();
    await idle();
    analytics.track("pending");
    expect(history.pushState).not.toBe(originalPush);
    analytics.shutdown();
    expect(removed.sort()).toEqual(added.sort());
    expect(history.pushState).toBe(originalPush);
    expect(vi.getTimerCount()).toBe(0);
  });
});
