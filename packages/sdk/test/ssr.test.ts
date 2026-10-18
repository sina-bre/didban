// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("server-side rendering", () => {
  it("imports and runs without browser globals, returning a no-op instance", async () => {
    expect(typeof window).toBe("undefined");
    const { createAnalytics } = await import("../src/index.js");
    const analytics = createAnalytics({ endpoint: "https://c.example", writeKey: "wk_ssr" });
    analytics.page();
    analytics.track("server_render");
    analytics.identify("user_1");
    analytics.shutdown();
    await expect(analytics.flush()).resolves.toBeUndefined();
  });
});
