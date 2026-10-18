import { act, cleanup, render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider, useAnalytics } from "../src/index.js";

type Sent = { type: string; name?: string };
let counter = 0;

function stubFetch() {
  const events: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      events.push(...JSON.parse(String(init.body)).events);
      return new Response(JSON.stringify({ accepted: 1, duplicates: 0, rejected: [] }));
    }),
  );
  return events;
}

function Signup() {
  const analytics = useAnalytics();
  useEffect(() => analytics.track("signup_viewed"), [analytics]);
  return <p>signup</p>;
}

function app(writeKey: string) {
  return (
    <AnalyticsProvider endpoint="https://collector.example" writeKey={writeKey}>
      <Signup />
    </AnalyticsProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  counter += 1;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function settle() {
  await act(() => vi.advanceTimersByTimeAsync(10_000));
}

describe("@didban/react", () => {
  it("sends one page view and the child's mount event", async () => {
    const events = stubFetch();
    render(app(`wk_react_${counter}`));
    await settle();
    expect(events.map((e) => e.name ?? e.type).sort()).toEqual(["page", "signup_viewed"]);
  });

  it("StrictMode double render/effects still give exactly one page view", async () => {
    const events = stubFetch();
    render(<StrictMode>{app(`wk_react_${counter}`)}</StrictMode>);
    await settle();
    expect(events.filter((e) => e.type === "page")).toHaveLength(1);
  });

  it("re-mounting (HMR) reuses the instance: no second page view", async () => {
    const events = stubFetch();
    const view = render(app(`wk_react_${counter}`));
    await settle();
    view.unmount();
    render(app(`wk_react_${counter}`));
    await settle();
    expect(events.filter((e) => e.type === "page")).toHaveLength(1);
  });

  it("useAnalytics outside a provider is a no-op that never throws", async () => {
    const events = stubFetch();
    render(<Signup />);
    await settle();
    expect(events).toEqual([]);
  });
});
