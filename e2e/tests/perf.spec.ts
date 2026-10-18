import { type Browser, expect, type Page, test } from "@playwright/test";

// Addendum A2: the SDK never causes a task > 5 ms on the host page. A Chrome performance trace is
// recorded while the page loads, idles, sends, navigates and scrolls; every script task that runs
// SDK code (script evaluation, callbacks, timers, idle callbacks) must stay under the limit.
const LIMIT_MS = 5;
const SCRIPT_EVENTS = new Set(["EvaluateScript", "FunctionCall", "v8.compile"]);

interface TraceEvent {
  name: string;
  ph: string;
  dur?: number;
  args?: { data?: { url?: string; functionName?: string } };
}

async function traceSdkTasks(browser: Browser, page: Page, run: () => Promise<void>, url: RegExp) {
  await browser.startTracing(page, { categories: ["devtools.timeline", "v8"] });
  await run();
  const trace = JSON.parse((await browser.stopTracing()).toString()) as {
    traceEvents: TraceEvent[];
  };
  return trace.traceEvents
    .filter((e) => e.ph === "X" && SCRIPT_EVENTS.has(e.name) && url.test(e.args?.data?.url ?? ""))
    .map((e) => ({
      name: `${e.name}(${e.args?.data?.functionName ?? ""})`,
      ms: (e.dur ?? 0) / 1000,
    }));
}

function report(label: string, tasks: { name: string; ms: number }[]) {
  const top = tasks.toSorted((a, b) => b.ms - a.ms).slice(0, 3);
  console.log(
    `${label}: ${tasks.length} tasks; longest ${top.map((t) => `${t.name} ${t.ms} ms`).join(", ")}`,
  );
  expect(tasks.length).toBeGreaterThan(0);
  expect(top[0]?.ms).toBeLessThanOrEqual(LIMIT_MS);
}

async function exercise(page: Page, site: string) {
  await page.goto(site);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500); // idle start + first send
  // Clicks reach the SDK's capture listener on document, but never leave the page.
  await page.evaluate(() => window.addEventListener("click", (e) => e.preventDefault(), true));
  for (const link of await page.getByRole("link").all()) await link.click();
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(6000); // interval flush
}

test("script-tag build: no SDK task over 5 ms", async ({ browser }) => {
  const page = await browser.newPage();
  const tasks = await traceSdkTasks(
    browser,
    page,
    () => exercise(page, "http://localhost:5304/"),
    /didban\.iife\.js/,
  );
  report("script-tag", tasks);
});

test("vanilla Vite build: no task of the bundle over 5 ms", async ({ browser }) => {
  const page = await browser.newPage();
  const tasks = await traceSdkTasks(
    browser,
    page,
    () => exercise(page, "http://localhost:5302/"),
    /\/assets\/index-.*\.js/,
  );
  report("vanilla", tasks);
});
