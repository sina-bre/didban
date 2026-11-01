import { expect, type Locator, type Page, test } from "@playwright/test";
import { signIn } from "./dashboard.js";
import { type Event, sendEvents } from "./ingest.js";
import { DASHBOARD_URL } from "./keys.js";
import { pageCounts, projectIdByName, referrerCounts, totals } from "./trace-db.js";

// Stage 5 gate: "every number traces to persisted events". A project made in the wizard gets real
// events from three visitors; Overview, Pages and Sources must show what SQL counts in the test DB.
test.use({ locale: "en-US", viewport: { width: 1280, height: 800 } });
const name = `E2E Trace ${Date.now().toString(36)}`;
const origin = "https://trace.e2e.example";
const google = "https://www.google.com/";
const VISITORS = [
  { ip: "203.0.113.11", referrer: google, paths: ["/", "/pricing"], track: true },
  { ip: "203.0.113.12", referrer: null, paths: ["/pricing"], track: false },
  { ip: "203.0.113.13", referrer: "https://duckduckgo.com/", paths: ["/", "/docs"], track: false },
];

/** The cells of the table row whose first cell is `label`. */
const cellsOf = (table: Locator, label: string) =>
  table
    .getByRole("row")
    .filter({ has: table.page().getByRole("cell", { name: label, exact: true }) })
    .getByRole("cell");

/** Project → environment → key in the wizard, then the live check; returns the new write key. */
async function wizard(page: Page): Promise<string> {
  await page.goto(`${DASHBOARD_URL}/projects/new`);
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Allowed origins").fill(origin);
  await page.getByRole("button", { name: "Create environment" }).click();
  await page.getByRole("button", { name: "Create write key" }).click();
  const key = (await page.locator("pre code").first().textContent()) ?? "";
  await page.getByRole("button", { name: "I added the snippet" }).click();
  return key;
}

async function expectPages(page: Page, projectId: string) {
  const pages = page.getByRole("table", { name: "Top pages" });
  const rows = await pageCounts(projectId);
  expect(rows.map((r) => r.route)).toEqual(["/", "/docs", "/pricing"]);
  await expect(pages.getByRole("row")).toHaveCount(rows.length + 1);
  for (const row of rows) {
    const cells = cellsOf(pages, `${row.route} trace.e2e.example`);
    await expect(cells.nth(1)).toHaveText(String(row.visitors));
    await expect(cells.nth(2)).toHaveText(String(row.pageviews));
  }
}

async function expectSources(page: Page, projectId: string) {
  const sources = page.getByRole("table", { name: "Referrer" });
  const rows = await referrerCounts(projectId);
  expect(rows.map((r) => r.referrer)).toEqual([null, "DuckDuckGo", "Google"]);
  await expect(sources.getByRole("row")).toHaveCount(rows.length + 1);
  for (const row of rows) {
    const cells = cellsOf(sources, row.referrer ? `Filter by ${row.referrer}` : "(not set)");
    await expect(cells.nth(1)).toHaveText(String(row.visitors));
    await expect(cells.nth(2)).toHaveText(String(row.visits));
  }
}

test("wizard → real events → overview, pages and sources equal the stored rows", async ({
  page,
  request,
}) => {
  await signIn(page);
  const key = await wizard(page);
  for (const v of VISITORS) {
    const events: Event[] = v.paths.map((path) => ({ type: "page", path }));
    if (v.track) events.push({ type: "track", path: "/pricing", name: "signup" });
    const sent = await sendEvents(request, { key, origin, events, referrer: v.referrer, ip: v.ip });
    expect(sent).toMatchObject({ status: 200, json: { accepted: events.length, rejected: [] } });
  }
  await expect(page.getByText("First event received")).toBeVisible({ timeout: 30_000 });
  const projectId = await projectIdByName(name);
  await expect.poll(async () => (await totals(projectId)).events).toBe(6);
  const stored = await totals(projectId);
  expect(stored).toEqual({ visitors: 3, visits: 3, pageviews: 5, events: 6 }); // what we sent
  const base = `${DASHBOARD_URL}/projects/${projectId}`;

  await page.goto(`${base}/overview`);
  const kpis = page.getByRole("region", { name: "Key metrics" });
  const shown = {
    Visitors: stored.visitors,
    Visits: stored.visits,
    "Page views": stored.pageviews,
  };
  for (const [label, value] of Object.entries(shown)) {
    const figure = kpis.getByRole("figure", { name: label, exact: true });
    await expect(figure.locator("bdi").filter({ visible: true })).toHaveText(String(value));
  }
  await page.goto(`${base}/pages`);
  await expectPages(page, projectId);
  await page.goto(`${base}/sources?by=referrer`);
  await expectSources(page, projectId);
});
