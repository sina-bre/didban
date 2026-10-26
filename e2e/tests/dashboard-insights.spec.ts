import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { externalHosts, projectBase, signIn } from "./dashboard.js";
import { sendBrowserEvents } from "./ingest.js";

// Stage 5d on the real API and test DB: every report, filters in the URL, interval, export.
const CAMPAIGN = "e2e-autumn";
const EVENT = "e2e_insight_signup";
let BASE = "";

test.beforeAll(async ({ request }) => {
  const sent = await sendBrowserEvents(request, [
    { type: "page", path: `/pricing?utm_source=e2e&utm_campaign=${CAMPAIGN}` },
    { type: "page", path: "/docs" },
    { type: "track", path: "/docs", name: EVENT, props: { plan: "pro" } },
  ]);
  expect(sent).toMatchObject({ status: 200, json: { accepted: 3, rejected: [] } });
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
  BASE = await projectBase();
});

test.use({ locale: "en-US" });

test("sources: a campaign row filters the reports via the URL; export carries it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const hosts = externalHosts(page);
  await page.goto(`${BASE}/sources`);
  await page.getByText("UTM campaign", { exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/sources?by=utm_campaign`);
  const filtered = page.waitForRequest(
    (r) => r.url().includes("/stats/sources") && r.url().includes("filter=utm_campaign"),
  );
  await page.getByRole("link", { name: `Filter by ${CAMPAIGN}` }).click();
  await filtered;
  await expect(page.getByText(`UTM campaign is ${CAMPAIGN}`)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const csv = readFileSync((await (await download).path()) ?? "", "utf8");
  expect(csv.split("\n")[0]).toContain("value,visitors,visits");
  expect(csv).toContain(CAMPAIGN);

  await page.getByRole("link", { name: "Pages", exact: true }).first().click();
  await expect(page).toHaveURL(/\/pages\?by=utm_campaign&filter=utm_campaign/);
  const top = page.getByRole("table", { name: "Top pages" });
  await expect(top.getByText("/pricing")).toBeVisible();
  await expect(top.getByText("/docs")).toHaveCount(0); // only the page view with the campaign
  await page.goBack();
  await expect(page.getByText(`UTM campaign is ${CAMPAIGN}`)).toBeVisible();
  expect([...hosts]).toEqual([]);
});

test("events: event, then property, then value adds a property filter", async ({ page }) => {
  await page.goto(`${BASE}/events`);
  await page
    .getByRole("table", { name: "Custom events" })
    .getByRole("link", { name: EVENT })
    .click();
  const keys = page.getByRole("table", { name: `Properties of ${EVENT}` });
  await keys.getByRole("link", { name: "plan" }).click();
  await page.getByRole("link", { name: "Filter by pro" }).click();
  await expect(page.getByText("Property plan is pro")).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll("filter")).toEqual(["prop.plan:eq:pro"]);
});

test("pages detail, geo off, devices, data health", async ({ page }) => {
  await page.goto(`${BASE}/pages`);
  await page
    .getByRole("table", { name: "Top pages" })
    .getByRole("link", { name: /\/docs/ })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "/docs" })).toBeVisible();
  await expect(page.getByText("Scroll depth is not collected")).toBeVisible();

  await page.goto(`${BASE}/geo`); // the e2e API has no GeoLite2 file
  await expect(page.getByText("Locations are not recorded")).toBeVisible();
  await page.goto(`${BASE}/devices?by=language`);
  const languages = page.getByRole("table", { name: "Language" });
  await expect(languages.getByText("German (Germany)")).toBeVisible();

  await page.goto(`${BASE}/data-health`);
  await expect(page.getByTestId("last-event")).not.toHaveText("None yet");
  await expect(page.getByRole("region", { name: "Events per hour" })).toBeVisible();
});

test("goals: add an event goal, see its conversion, delete it", async ({ page }) => {
  await page.goto(`${BASE}/goals`);
  await page.getByRole("button", { name: "Add goal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add goal" });
  await dialog.getByLabel("Name", { exact: true }).fill("E2E signup");
  await dialog.getByLabel("Event name").fill(EVENT);
  await dialog.getByRole("button", { name: "Create goal" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row", { name: /E2E signup/ });
  await expect(row.getByRole("cell").nth(1)).toHaveText("1");
  await row.getByRole("button", { name: "Delete goal E2E signup" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete E2E signup?" });
  await confirm.getByRole("button", { name: "Delete goal" }).click();
  await expect(page.getByRole("row", { name: /E2E signup/ })).toHaveCount(0);
});

test("overview interval: weekly goes to the time series request", async ({ page }) => {
  // 90 days: a range no earlier spec asked for, so the API's 15 s cache has no empty answer.
  await page.goto(`${BASE}/overview?range=90d`);
  const weekly = page.waitForRequest(
    (r) => r.url().includes("/stats/timeseries") && r.url().includes("interval=week"),
  );
  await page.getByText("Weekly", { exact: true }).click();
  await weekly;
  await expect(page).toHaveURL(`${BASE}/overview?range=90d&interval=week`);
});

test.describe("Persian, 360 px", () => {
  test.use({ locale: "fa-IR" });

  test("sources and events fit and are rtl", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.goto(`${BASE}/sources`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("table", { name: "کانال" })).toBeVisible();
    expect(await overflow()).toBe(false);
    await page.goto(`${BASE}/events`);
    await expect(page.getByRole("table", { name: "رویدادهای سفارشی" })).toBeVisible();
    expect(await overflow()).toBe(false);
  });
});
