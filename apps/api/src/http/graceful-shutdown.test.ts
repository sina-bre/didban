import { expect, it } from "vitest";
import { testEnv } from "../test-support/test-env.js";
import { createApp } from "./create-app.js";
import { drainAndClose } from "./graceful-shutdown.js";

// ADR 0047: during the drain the proxy's health check sees 503 while requests are still served.
it("drains: /ready answers 503 at once, other requests are served until the wait ends", async () => {
  const app = await createApp(testEnv());
  await app.listen(0, "127.0.0.1");
  const base = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  const get = (path: string) => fetch(`${base}/api/v1/health/${path}`).then((r) => r.status);
  expect(await get("ready")).toBe(200);

  const started = Date.now();
  const closed = drainAndClose(app, 400);
  expect(await get("ready")).toBe(503);
  expect(await get("live")).toBe(200);
  await closed;
  expect(Date.now() - started).toBeGreaterThanOrEqual(390);
  await expect(get("live")).rejects.toThrow();
});
