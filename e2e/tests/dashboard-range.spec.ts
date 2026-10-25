import { expect, test } from "@playwright/test";

// Stage 5b: the report range picker on the production build (URL state, lazy React Aria field).
const BASE = "http://127.0.0.1:5173";
const OVERVIEW = `${BASE}/projects/p1/overview`;

test.use({ locale: "en-US" });

test("desktop: preset pills and a typed custom range live in the URL", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const chunks: string[] = [];
  page.on("request", (req) => req.url().includes("/assets/") && chunks.push(req.url()));
  await page.goto(OVERVIEW);
  await page.getByText("7 days", { exact: true }).click();
  await expect(page).toHaveURL(`${OVERVIEW}?range=7d`);
  await expect(page.getByTestId("range")).toContainText("Last 7 days");
  // React Aria is not loaded until "Custom" is opened (ADR 0040).
  expect(chunks.filter((url) => url.includes("date-range-field"))).toEqual([]);

  await page.getByRole("button", { name: "Custom" }).click();
  const field = page.getByRole("group", { name: "Start and end date" });
  await field.getByRole("spinbutton", { name: /month/i }).first().click();
  await page.keyboard.type("10012026"); // start: Oct 1 2026; focus moves on to the end date
  await page.keyboard.type("10052026");
  // Nothing is written while typing (year "2" on the way to "2026" is a valid date)...
  await expect(page).toHaveURL(`${OVERVIEW}?range=7d`);
  await page.keyboard.press("Enter"); // ...the finished edit is one URL change
  await expect(page).toHaveURL(`${OVERVIEW}?from=2026-10-01&to=2026-10-05`);
  await expect(page.getByTestId("range")).toContainText("Custom · Oct 1 – 5, 2026");
  expect(chunks.some((url) => url.includes("date-range-field"))).toBe(true);

  await page.goBack();
  await expect(page.getByTestId("range")).toContainText("Last 7 days");
});

test.describe("Persian, 360 px", () => {
  test.use({ locale: "fa-IR" });

  test("pills fit, 44 px targets, custom field in the Persian calendar", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${OVERVIEW}?from=2026-10-01&to=2026-10-05`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("range")).toContainText("دلخواه");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    for (const pill of await page.locator("fieldset label").all()) {
      expect((await pill.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    // A custom range in the URL opens the field; its year segment shows the Persian year.
    const field = page.getByRole("group", { name: "تاریخ شروع و پایان" });
    await expect(field.getByRole("spinbutton", { name: /year|سال/i }).first()).toHaveText("۱۴۰۵");
  });
});
