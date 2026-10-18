import { expect, test } from "@playwright/test";
import { clearRecords, events, eventually, LOOPBACK, pagePaths, records } from "./collector.js";
import { storedEvents, storedPagePaths } from "./db.js";
import { PROJECTS } from "./keys.js";

const SITE = "http://localhost:5303";
const FRONT = "http://localhost:5305"; // front-proxy.mjs → SITE
const KEY = PROJECTS.next.key;
const SLUG = PROJECTS.next.slug;

test.beforeEach(clearRecords);

const emptyBatch = () =>
  JSON.stringify({ schemaVersion: 1, sentAt: new Date().toISOString(), writeKey: KEY, events: [] });

test("Link and router.push give exactly one page view each (dev, StrictMode)", async ({ page }) => {
  const since = new Date();
  await page.goto(`${SITE}/`);
  const docsButton = page.getByRole("button", { name: "Open docs (router.push)" });
  await expect(docsButton).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  await page.getByRole("link", { name: "Home" }).click();
  await docsButton.click();
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
  await eventually(
    () => events(KEY),
    (list) => {
      expect(pagePaths(list)).toEqual(["/", "/pricing", "/", "/docs"]);
      expect(list.filter((e) => e.name === "docs_opened")).toHaveLength(1);
    },
  );
  // Exactly once per navigation in PostgreSQL too (no duplicate rows from retries or StrictMode).
  await eventually(
    () => storedEvents(SLUG, since),
    (stored) => {
      expect(storedPagePaths(stored)).toEqual(["/", "/pricing", "/", "/docs"]);
      expect(stored.filter((e) => e.name === "docs_opened")).toHaveLength(1);
    },
  );
});

// Next.js rewrites pass X-Forwarded-For through but never add the visitor's address, so the
// client IP only reaches the collector when a front proxy (Caddy/Nginx, here front-proxy.mjs)
// sets it. Both halves are pinned here so a Next.js change shows up as a failing test.
test("behind a front proxy the visitor IP reaches the collector", async ({ request }) => {
  await request.post(`${FRONT}/a/e/api/v1/ingest/batch`, { data: emptyBatch() });
  const [forwarded] = await records(KEY);
  expect(forwarded?.forwardedFor).toMatch(LOOPBACK);
});

test("Next.js alone does not add X-Forwarded-For", async ({ request }) => {
  await request.post(`${SITE}/a/e/api/v1/ingest/batch`, { data: emptyBatch() });
  const [direct] = await records(KEY);
  expect(direct?.forwardedFor).toBeNull();
});

test("the 404 page sends one page_not_found with the path", async ({ page }) => {
  const since = new Date();
  await page.goto(`${SITE}/missing`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await eventually(
    () => events(KEY),
    (list) => {
      const missing = list.filter((e) => e.name === "page_not_found");
      expect(missing.map((e) => e.properties)).toEqual([{ path: "/missing" }]);
    },
  );
  await eventually(
    () => storedEvents(SLUG, since),
    (stored) => expect(stored.filter((e) => e.name === "page_not_found")).toHaveLength(1),
  );
});
