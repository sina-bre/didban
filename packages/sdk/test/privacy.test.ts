import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setup, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  delete (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl;
});

const noPageviews = { autoCapture: { pageviews: false } };

function setNavigator(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

describe("consent", () => {
  it("holds events while pending and sends them once granted", async () => {
    const { events } = stubFetch();
    const analytics = setup({ requireConsent: true });
    await idle();
    analytics.track("waiting");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events()).toHaveLength(0);
    analytics.setConsent("granted");
    await analytics.flush();
    expect(events().map((e) => e.type)).toEqual(["page", "track"]);
  });

  it("drops queued and later events when denied", async () => {
    const { events } = stubFetch();
    const analytics = setup({ requireConsent: true });
    await idle();
    analytics.setConsent("denied");
    analytics.track("ignored");
    analytics.setConsent("granted");
    await analytics.flush();
    expect(events()).toHaveLength(0);
  });
});

describe("browser privacy signals", () => {
  it("sends nothing with Global Privacy Control", async () => {
    setNavigator("globalPrivacyControl", true);
    const { sent } = stubFetch();
    setup().track("x");
    await idle(10_000);
    expect(sent).toHaveLength(0);
  });

  it("sends nothing with Do Not Track, unless told to ignore it", async () => {
    setNavigator("doNotTrack", "1");
    const { sent } = stubFetch();
    setup().track("x");
    await idle(10_000);
    expect(sent).toHaveLength(0);
    setup({ respectDoNotTrack: false });
    await idle(10_000);
    expect(sent).toHaveLength(1);
    setNavigator("doNotTrack", null);
  });
});

describe("opt-out", () => {
  it("optOut persists in storage and optIn clears it", async () => {
    const { events } = stubFetch();
    const analytics = setup(noPageviews);
    analytics.optOut();
    analytics.track("hidden");
    await analytics.flush();
    expect(localStorage.getItem("didban_opt_out")).toBe("1");
    analytics.optIn();
    analytics.track("visible");
    await analytics.flush();
    expect(events().map((e) => e.name)).toEqual(["visible"]);
  });

  it("?no_track=1 opts this browser out", async () => {
    window.history.replaceState(null, "", "/start?no_track=1");
    const { sent } = stubFetch();
    setup();
    await idle(10_000);
    expect(sent).toHaveLength(0);
    expect(localStorage.getItem("didban_opt_out")).toBe("1");
  });
});

describe("identity", () => {
  it("cookieless sends no stable ID and stores nothing", async () => {
    const { events } = stubFetch();
    const analytics = setup(noPageviews);
    analytics.track("a");
    await analytics.flush();
    expect(events()[0]?.anonymousId).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });

  it("persistent shares one anonymousId across instances (tabs) and reset rotates it", async () => {
    const { events } = stubFetch();
    const first = setup({ ...noPageviews, identity: "persistent" });
    const second = setup({ ...noPageviews, identity: "persistent" });
    first.track("a");
    second.track("b");
    await first.flush();
    await second.flush();
    const [a, b] = events();
    expect(a?.anonymousId).toBeTruthy();
    expect(b?.anonymousId).toBe(a?.anonymousId);
    first.identify("user_1");
    first.reset();
    first.track("c");
    await first.flush();
    expect(events().at(-1)?.anonymousId).not.toBe(a?.anonymousId);
    expect(events().at(-1)?.userId).toBeUndefined();
  });

  it("identify sets userId on later events and sends one identify event", async () => {
    const { events } = stubFetch();
    const analytics = setup(noPageviews);
    analytics.identify("user_123");
    analytics.track("after");
    await analytics.flush();
    expect(events().map((e) => [e.type, e.userId])).toEqual([
      ["identify", "user_123"],
      ["track", "user_123"],
    ]);
  });
});
