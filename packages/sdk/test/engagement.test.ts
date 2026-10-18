import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "../src/index.js";
import { engagedTime } from "../src/modules/engaged-time.js";
import { scrollDepth } from "../src/modules/scroll-depth.js";
import { cleanup, idle, setDocumentProperty, setup, stubBeacon, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  setDocumentProperty("visibilityState", "visible");
  cleanup();
});

type Sent = { type: string; name?: string; url: string; properties: Record<string, unknown> };
const named = (events: () => Sent[], name: string) => events().filter((e) => e.name === name);

function scrollTo(y: number) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 4000,
    configurable: true,
  });
  vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("scrollY", y);
  window.dispatchEvent(new Event("scroll"));
}

describe("scroll-depth module", () => {
  it("sends each threshold once per page view, one measurement per frame", async () => {
    const { events } = stubFetch();
    const raf = vi.fn((fn: FrameRequestCallback) => setTimeout(fn, 16) as unknown as number);
    vi.stubGlobal("requestAnimationFrame", raf);
    setup({ autoCapture: { scrollDepth: scrollDepth() } });
    await idle();
    scrollTo(1100); // 52 %
    scrollTo(1200);
    scrollTo(2000); // 75 %, same frame
    await idle(20);
    expect(raf).toHaveBeenCalledTimes(1);
    scrollTo(0);
    await idle(20);
    history.pushState({}, "", "/next");
    await idle();
    scrollTo(3000); // 100 % on the new page
    await idle(10_000);
    const percents = named(events, "scroll_depth").map((e) => e.properties.percent);
    expect(percents).toEqual([25, 50, 75, 25, 50, 75, 100]);
  });
});

describe("engaged-time module", () => {
  it("counts visible + focused time and sends it for the page being left", async () => {
    const { events } = stubFetch();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    setup({ autoCapture: { engagedTime: engagedTime() } });
    await idle();
    await vi.advanceTimersByTimeAsync(4000);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    await vi.advanceTimersByTimeAsync(60_000); // not focused: not counted
    history.pushState({}, "", "/next");
    await idle(10_000);
    const sent = named(events, "engaged_time");
    expect(sent.map((e) => [e.url, e.properties.seconds])).toEqual([
      ["https://shop.example/start", 4],
    ]);
  });

  it("queues its event before the page-hide beacon", async () => {
    stubFetch();
    const beacons = stubBeacon();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    setup({ autoCapture: { engagedTime: engagedTime() }, flushIntervalMs: 60_000 });
    await idle();
    await vi.advanceTimersByTimeAsync(3000);
    setDocumentProperty("visibilityState", "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    const names = beacons.flatMap((b) => b.body.events.map((e) => e.name ?? e.type));
    expect(names).toContain("engaged_time");
  });
});

describe("notFound", () => {
  it("sends page_not_found with the path only", async () => {
    const { events } = stubFetch();
    history.replaceState(null, "", "/missing/page?q=x");
    notFound(setup());
    await idle(10_000);
    expect(named(events, "page_not_found").map((e) => e.properties)).toEqual([
      { path: "/missing/page" },
    ]);
  });
});
