import { expect, test } from "@playwright/test";
import { externalHosts, projectBase, signIn } from "./dashboard.js";

// Stage 5c: Overview and Realtime on real API answers (the seeded project may have no events yet,
// so the checks are about structure, URL state and polling, not about counts).
test.beforeEach(async ({ page }) => signIn(page));

test.describe("English, desktop", () => {
  test.use({ locale: "en-US" });

  test("overview: compare switch in the URL, compare sent to the API", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const hosts = externalHosts(page);
    const base = await projectBase();
    await page.goto(`${base}/overview`);
    await expect(page.getByRole("region", { name: "Key metrics" })).toBeVisible();
    const compared = page.waitForRequest(
      (r) => r.url().includes("/stats/overview") && r.url().includes("compare=previous_period"),
    );
    // Click the visible label, as a user does (the input itself is visually hidden).
    await page.getByText("Compare with previous period").click();
    await expect(page.getByRole("switch", { name: "Compare with previous period" })).toBeChecked();
    await compared;
    await expect(page).toHaveURL(`${base}/overview?compare=previous_period`);
    expect([...hosts]).toEqual([]);
  });

  test("realtime polls every 10 s", async ({ page }) => {
    const base = await projectBase();
    const polls: number[] = [];
    page.on("request", (r) => r.url().includes("/stats/realtime") && polls.push(Date.now()));
    await page.goto(`${base}/realtime`);
    await expect(page.getByRole("region", { name: "Active visitors" })).toBeVisible();
    await expect.poll(() => polls.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const gap = (polls[1] ?? 0) - (polls[0] ?? 0);
    expect(gap).toBeGreaterThan(9_000);
    expect(gap).toBeLessThan(12_000);
  });
});

test.describe("Persian, 360 px", () => {
  test.use({ locale: "fa-IR" });

  test("login, overview and realtime fit, rtl, 44 px switcher", async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const base = await projectBase();
    await page.goto(`${base}/overview`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("region", { name: "شاخص‌های اصلی" })).toBeVisible();
    const switcher = page.getByRole("button", { name: /تغییر سازمان و پروژه/ });
    expect((await switcher.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await overflow()).toBe(false);

    await page.goto(`${base}/realtime`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("لحظه‌ای");
    expect(await overflow()).toBe(false);

    await context.clearCookies();
    await page.goto(`${base}/overview`);
    await expect(page.getByRole("heading", { name: "ورود" })).toBeVisible();
    expect(await overflow()).toBe(false);
  });
});
