import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setDocumentProperty, setup, stubBeacon, stubFetch } from "./helpers.js";

// Addendum A2: the start is split into short idle tasks (checks + listeners, then storage, page
// views and the first send, each its own callback). In jsdom an idle task is a 1 ms timeout: the
// first `tick()` runs the checks, the second runs the three later steps.
beforeEach(() => vi.useFakeTimers());
afterEach(cleanup);

const tick = () => vi.advanceTimersByTimeAsync(1);

describe("idle start in steps", () => {
  it("queues the page view and sends it in later idle tasks than the checks", async () => {
    const { sent, events } = stubFetch();
    setup();
    await tick();
    expect(sent).toHaveLength(0);
    await tick();
    expect(events().map((e) => e.type)).toEqual(["page"]);
  });

  it("page hide between the steps still sends the first page view", async () => {
    const { sent } = stubFetch();
    const beacons = stubBeacon();
    setup();
    await tick();
    setDocumentProperty("visibilityState", "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    setDocumentProperty("visibilityState", "visible");
    expect(beacons.flatMap((b) => b.body.events.map((e) => e.type))).toEqual(["page"]);
    await idle(10_000);
    expect(sent).toHaveLength(0); // the beacon took it; the later idle tasks are no-ops
  });

  it("flush() between the steps sends the first page view once", async () => {
    const { events } = stubFetch();
    const analytics = setup();
    await tick();
    await analytics.flush();
    await idle(10_000);
    expect(events().map((e) => e.type)).toEqual(["page"]);
  });

  it("shutdown() between the steps beacons the page view and runs nothing later", async () => {
    const { sent } = stubFetch();
    const beacons = stubBeacon();
    const analytics = setup();
    await tick();
    analytics.shutdown();
    expect(beacons.flatMap((b) => b.body.events.map((e) => e.type))).toEqual(["page"]);
    await idle(10_000);
    expect(sent).toHaveLength(0);
  });
});
