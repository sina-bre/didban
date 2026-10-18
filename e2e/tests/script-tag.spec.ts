import { expect, test } from "@playwright/test";
import { clearRecords, events, eventually, LOOPBACK, pagePaths, records } from "./collector.js";

const SITE = "http://localhost:5304";
const KEY = "wk_e2e_script";

test.beforeEach(clearRecords);

test("loads under a strict CSP with SRI and exposes window.analytics", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(e.message));
  const response = await page.goto(`${SITE}/`);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  await expect(page.locator("script[integrity^='sha384-']")).toHaveCount(1);
  await page.waitForFunction(() => typeof window.analytics?.track === "function");
  await page.evaluate(() => window.analytics?.track("pricing_viewed", { plan: "pro" }));
  await page.evaluate(() => window.analytics?.flush());
  await eventually(
    () => events(KEY),
    (list) => {
      expect(pagePaths(list)).toEqual(["/"]);
      expect(list.filter((e) => e.name === "pricing_viewed")).toHaveLength(1);
    },
  );
  for (const r of await records(KEY)) expect(r.forwardedFor ?? "").toMatch(LOOPBACK);
  expect(problems).toEqual([]);
});

declare global {
  interface Window {
    analytics?: { track(name: string, props?: object): void; flush(): Promise<void> };
  }
}
