import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setup, stubFetch } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(cleanup);

async function pageUrls(events: () => { type: string; url: string }[]) {
  await idle(10_000);
  return events()
    .filter((e) => e.type === "page")
    .map((e) => e.url.replace("https://shop.example", ""));
}

describe("SPA page views", () => {
  it("counts one view per real URL change (pushState, replaceState, popstate)", async () => {
    const { events } = stubFetch();
    setup();
    await idle();
    history.pushState({}, "", "/pricing");
    await idle();
    history.replaceState({ scroll: 10 }, "", "/pricing"); // state only
    history.pushState({}, "", "/pricing#faq"); // hash only
    await idle();
    history.pushState({}, "", "/pricing?plan=pro");
    await idle();
    history.back();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await pageUrls(events)).toEqual(["/start", "/pricing", "/pricing?plan=pro", "/pricing"]);
  });

  it("coalesces several navigations in one task into one view", async () => {
    const { events } = stubFetch();
    setup();
    await idle();
    history.pushState({}, "", "/a");
    history.pushState({}, "", "/b");
    history.replaceState({}, "", "/c");
    expect(await pageUrls(events)).toEqual(["/start", "/c"]);
  });

  it("sends the previous URL as referrer on SPA views", async () => {
    const { events } = stubFetch();
    setup();
    await idle();
    history.pushState({}, "", "/next");
    await idle(10_000);
    expect(events()[1]?.referrer).toBe("https://shop.example/start");
  });
});

describe("SPA hash routing", () => {
  it("hash mode counts fragment changes", async () => {
    const { events } = stubFetch();
    setup({ autoCapture: { spa: "hash" } });
    await idle();
    location.hash = "#settings";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(await pageUrls(events)).toEqual(["/start", "/start#settings"]);
  });

  it("auto mode treats #/route as a page and #anchor as the same page", async () => {
    const { events } = stubFetch();
    setup();
    await idle();
    history.pushState({}, "", "/start#anchor");
    await idle();
    history.pushState({}, "", "/start#/inbox");
    expect(await pageUrls(events)).toEqual(["/start", "/start#/inbox"]);
  });
});

describe("SPA history patch and exclusions", () => {
  it("chains with another library's history patch and keeps it after shutdown", async () => {
    const { events } = stubFetch();
    const analytics = setup();
    await idle();
    const ours = history.pushState;
    const seen: string[] = [];
    history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      seen.push(String(args[2]));
      return ours.apply(this, args);
    };
    const theirs = history.pushState;
    history.pushState({}, "", "/x");
    expect(await pageUrls(events)).toEqual(["/start", "/x"]);
    analytics.shutdown();
    expect(history.pushState).toBe(theirs);
    history.pushState({}, "", "/y");
    expect(seen).toEqual(["/x", "/y"]);
    expect(await pageUrls(events)).toEqual(["/start", "/x"]);
  });

  it("skips excluded paths and does nothing with spa off", async () => {
    const { events } = stubFetch();
    setup({ excludePaths: ["/admin/**", "/preview/*"] });
    await idle();
    for (const path of ["/admin/users/1", "/preview/a", "/preview/a/b"]) {
      history.pushState({}, "", path);
      await idle();
    }
    expect(await pageUrls(events)).toEqual(["/start", "/preview/a/b"]);
  });

  it("spa off: only the initial view", async () => {
    const { events } = stubFetch();
    setup({ autoCapture: { spa: "off" } });
    await idle();
    history.pushState({}, "", "/elsewhere");
    expect(await pageUrls(events)).toEqual(["/start"]);
  });
});
