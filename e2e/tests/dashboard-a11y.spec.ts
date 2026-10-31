import { type Page, test } from "@playwright/test";
import { auditPage } from "./audit.js";
import { projectBase, signIn } from "./dashboard.js";
import { sendBrowserEvents } from "./ingest.js";
import { DASHBOARD_URL } from "./keys.js";

// Stage 5f: every page in Persian (the RTL proof) on a phone and a desktop, with real rows:
// right to left, no sideways scrolling, no axe WCAG 2.2 AA violations, 44 px targets on phones.
test.use({ locale: "fa-IR" });
const WIDTHS = [360, 1280];
const REPORTS = "overview realtime pages sources geo devices events goals".split(" ");
const SETTINGS = "general environments keys routes members sharing data audit".split(" ");

async function orgId(page: Page): Promise<string> {
  const orgs = await (await page.request.get(`${DASHBOARD_URL}/api/v1/organizations`)).json();
  return orgs.organizations[0].id;
}

async function auditAll(page: Page, urls: string[]) {
  for (const width of WIDTHS) for (const url of urls) await auditPage(page, url, width);
}

test.beforeAll(async ({ request }) => {
  await sendBrowserEvents(request, [
    { type: "page", path: "/a11y?utm_source=audit" },
    { type: "track", path: "/a11y", name: "a11y_check", props: { step: "one" } },
  ]);
});

test("reports, project settings and the wizard", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page);
  const base = await projectBase();
  await auditAll(page, [
    `${DASHBOARD_URL}/projects`,
    `${DASHBOARD_URL}/projects/new`,
    ...REPORTS.map((r) => `${base}/${r}?range=90d`),
    `${base}/pages/detail?hostname=localhost&route=%2Fa11y&range=90d`,
    `${base}/data-health`,
    ...SETTINGS.map((s) => `${base}/settings/${s}`),
  ]);
});

test("organization settings and the admin area", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const org = `${DASHBOARD_URL}/organizations/${await orgId(page)}/settings`;
  await auditAll(
    page,
    ["members", "projects", "audit"].map((s) => `${org}/${s}`),
  );
  const admin = await (await browser.newContext({ locale: "fa-IR" })).newPage();
  await signIn(admin, "admin");
  const area = ["organizations", "users", "instance"].map((s) => `${DASHBOARD_URL}/admin/${s}`);
  await auditAll(admin, area);
});

test("login, set password and a dead share link", async ({ page, browser }) => {
  await auditAll(page, [`${DASHBOARD_URL}/login`, `${DASHBOARD_URL}/share#dsh_invalid`]);
  const fresh = await (await browser.newContext({ locale: "fa-IR" })).newPage();
  await signIn(fresh, "fresh");
  await auditAll(fresh, [`${DASHBOARD_URL}/set-password`]);
});
