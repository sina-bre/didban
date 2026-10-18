import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setup, stubFetch } from "./helpers.js";

// jsdom cannot change its origin after load, so these tests swap `window` for a proxy that
// reports another location (and, for iframes, a parent that throws like a cross-origin one).

beforeEach(() => vi.useFakeTimers());
afterEach(cleanup);

function fakeWindow(href: string, crossOriginParent = false) {
  const real = window;
  const location = new URL(href);
  const top = crossOriginParent
    ? {
        get location(): Location {
          throw new DOMException("Blocked a frame", "SecurityError");
        },
      }
    : undefined;
  const proxy: Window = new Proxy(real, {
    get(target, key) {
      if (key === "location") return location;
      if (key === "top") return top ?? proxy;
      if (key === "self") return proxy;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  vi.stubGlobal("window", proxy);
}

async function sentFor(href: string, options = {}, crossOriginParent = false) {
  const { sent } = stubFetch();
  fakeWindow(href, crossOriginParent);
  const analytics = setup(options);
  await idle(10_000);
  analytics.track("x");
  await analytics.flush();
  return sent.length;
}

describe("environments that are not tracked", () => {
  it("file:// pages are a no-op", async () => {
    expect(await sentFor("file:///C:/site/index.html")).toBe(0);
  });

  it("iframes with a cross-origin parent are a no-op", async () => {
    expect(await sentFor("https://shop.example/embed", {}, true)).toBe(0);
  });

  it("localhost is skipped unless trackLocalhost is set", async () => {
    expect(await sentFor("http://localhost:5173/")).toBe(0);
    expect(await sentFor("http://127.0.0.1:5173/")).toBe(0);
    expect(await sentFor("http://localhost:5173/", { trackLocalhost: true })).toBeGreaterThan(0);
  });

  it("hostAllowlist limits tracking to the listed hosts", async () => {
    expect(
      await sentFor("https://staging.shop.example/", { hostAllowlist: ["shop.example"] }),
    ).toBe(0);
    expect(
      await sentFor("https://shop.example/", { hostAllowlist: ["Shop.Example"] }),
    ).toBeGreaterThan(0);
  });
});
