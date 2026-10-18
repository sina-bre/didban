import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, idle, setDocumentProperty, stubFetch } from "./helpers.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});
afterEach(() => {
  window.analytics?.shutdown();
  window.analytics = undefined;
  setDocumentProperty("currentScript", null);
  cleanup();
});

async function load(data: Record<string, string>) {
  const script = document.createElement("script");
  Object.assign(script.dataset, data);
  setDocumentProperty("currentScript", script);
  await import("../src/script.js");
}

describe("script-tag build", () => {
  it("reads data attributes and exposes window.analytics with notFound()", async () => {
    const { sent, events } = stubFetch();
    await load({ endpoint: "/a/e", writeKey: "wk_script_1", modules: "outbound-links, bogus" });
    window.analytics?.notFound();
    await idle(10_000);
    expect(sent[0]?.url).toBe("/a/e/api/v1/ingest/batch");
    expect(sent[0]?.body.writeKey).toBe("wk_script_1");
    expect(
      events()
        .map((e) => e.name ?? e.type)
        .sort(),
    ).toEqual(["page", "page_not_found"]);
  });

  it("stays a no-op without a write key and never throws", async () => {
    const { sent } = stubFetch();
    await load({ endpoint: "/a/e" });
    expect(() => window.analytics?.track("x")).not.toThrow();
    await idle(10_000);
    expect(sent).toEqual([]);
  });
});
