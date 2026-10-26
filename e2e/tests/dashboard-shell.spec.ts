import { expect, test } from "@playwright/test";
import { externalHosts, projectBase, signIn } from "./dashboard.js";

// Stage 5a: the dashboard shell on the production build (desktop + mobile, en + fa).
let BASE = ""; // `/projects/<id>` of the seeded project
let OVERVIEW = "";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  BASE = await projectBase();
  OVERVIEW = `${BASE}/overview`;
});

test.use({ locale: "en-US" });

test("desktop: pill nav, 30-day default, range kept across reports and history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const hosts = externalHosts(page);
  await page.goto(OVERVIEW);
  const pills = page.getByRole("navigation", { name: "Reports" }).first();
  await expect(pills.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("range")).toContainText("Last 30 days");
  await expect(page.locator("nav.fixed")).toBeHidden(); // no bottom tab bar on desktop

  await page.goto(`${OVERVIEW}?range=7d`);
  await pills.getByRole("link", { name: "Sources" }).click();
  await expect(page).toHaveURL(`${BASE}/sources?range=7d`);
  await expect(page.getByTestId("range")).toContainText("Last 7 days");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  expect([...hosts]).toEqual([]);
});

test("fa: rtl document, persisted choice, only the active script's fonts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const fonts: string[] = [];
  page.on("request", (req) => req.resourceType() === "font" && fonts.push(req.url()));
  await page.goto(OVERVIEW);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  expect(fonts.some((url) => url.includes("inter-latin-wght"))).toBe(true);
  expect(fonts.filter((url) => url.includes("vazirmatn"))).toEqual([]);

  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("نمای کلی");
  await expect(page.getByTestId("range")).toContainText("۳۰ روز گذشته");
  expect(fonts.some((url) => url.includes("vazirmatn-arabic-wght"))).toBe(true);

  // Logical layout: the wordmark sits on the right in RTL.
  const box = await page.getByText("didban", { exact: true }).boundingBox();
  expect(box?.x).toBeGreaterThan(640);
});

test("mobile 360 px: tab bar, 44 px targets, no overflow, More sheet", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(OVERVIEW);
  const tabs = page.locator("nav.fixed");
  await expect(tabs).toBeVisible();
  // The pill nav is display:none here, so the tab bar is the only "Reports" navigation.
  await expect(page.getByRole("navigation", { name: "Reports" })).toHaveCount(1);
  for (const item of await tabs.locator("a, button").all()) {
    const box = await item.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);

  await tabs.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "More reports" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await tabs.getByRole("button", { name: "More" }).click();
  await sheet.getByRole("link", { name: "Goals" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(`${BASE}/goals`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Goals");
});

test.describe("Persian browser", () => {
  test.use({ locale: "fa-IR" });

  test("first visit starts in fa, rtl", async ({ page }) => {
    await page.goto(OVERVIEW);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("نمای کلی");
  });
});
