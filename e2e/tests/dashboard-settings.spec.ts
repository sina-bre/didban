import { expect, type Page, test } from "@playwright/test";
import { projectBase, signIn } from "./dashboard.js";
import { sendEvents } from "./ingest.js";
import { DASHBOARD_URL } from "./keys.js";

// Stage 5e on the real API and test DB: onboarding with the live check, settings, sharing,
// members with temporary passwords, the audit log and the platform admin pages.
test.use({ locale: "en-US" });
const run = Date.now().toString(36);
const api = (path: string) => `${DASHBOARD_URL}/api/v1${path}`;
const headers = { origin: DASHBOARD_URL };

/** The e2e org's id and a fresh project in it, through the API with the page's session. */
async function newProject(page: Page, name: string) {
  const orgs = await (await page.request.get(api("/organizations"))).json();
  const orgId: string = orgs.organizations[0].id;
  const res = await page.request.post(api(`/organizations/${orgId}/projects`), {
    data: { name },
    headers,
  });
  expect(res.status()).toBe(201);
  return { orgId, projectId: (await res.json()).id as string };
}

test("onboarding: project → environment → key → live check names the cause, fix, first event", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await signIn(page);
  await page.goto(`${await projectBase()}/overview`);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await expect(page).toHaveURL(`${DASHBOARD_URL}/projects/new`);
  await page.getByLabel("Project name").fill(`E2E Wizard ${run}`);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Allowed origins").fill("https://wizard.e2e.example");
  await page.getByRole("button", { name: "Create environment" }).click();
  await page.getByRole("button", { name: "Create write key" }).click();
  const key = (await page.locator("pre code").first().textContent()) ?? "";
  expect(key).toMatch(/^dpk_/);
  await expect(page.getByText(`writeKey: "${key}"`)).toBeVisible();
  await page.getByRole("button", { name: "I added the snippet" }).click();
  await expect(page.getByText("Waiting for the first event…")).toBeVisible();

  const wrong = "https://www.wizard.e2e.example";
  const event = { type: "page" as const, path: "/" };
  const refused = await sendEvents(request, { key, origin: wrong, events: [event] });
  expect(refused).toMatchObject({ status: 403, json: { error: { code: "ORIGIN_NOT_ALLOWED" } } });
  const cause = `Events were rejected with ORIGIN_NOT_ALLOWED from ${wrong}.`;
  await expect(page.getByText(cause)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: `Allow ${wrong}` }).click();
  await expect(page.getByText(`${wrong} is now allowed`)).toBeVisible();
  const accepted = await sendEvents(request, { key, origin: wrong, events: [event] });
  expect(accepted).toMatchObject({ status: 200, json: { accepted: 1 } });
  await expect(page.getByText("First event received")).toBeVisible({ timeout: 30_000 });
});

test("settings save; a share link opens read only without a session; revoking closes it", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const name = `E2E Settings ${run}`;
  const { projectId } = await newProject(page, name);
  const settings = `${DASHBOARD_URL}/projects/${projectId}/settings`;
  await page.goto(`${settings}/general`);
  await page.getByLabel("Visit timeout (minutes)").fill("45");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Visit timeout (minutes)")).toHaveValue("45");

  await page.getByRole("link", { name: "Sharing" }).click();
  await page.getByLabel("Label").fill("Board");
  await page.getByRole("button", { name: "Create link" }).click();
  const url = (await page.getByRole("dialog").locator("code").textContent()) ?? "";
  expect(url).toMatch(new RegExp(`^${DASHBOARD_URL}/share#dsh_`));
  const visitor = await (await browser.newContext({ locale: "en-US" })).newPage();
  const shareRequests: string[] = [];
  visitor.on("request", (r) => shareRequests.push(r.url()));
  await visitor.goto(url);
  await expect(visitor.getByText(`${name} · Board`)).toBeVisible();
  await expect(visitor.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  expect(shareRequests.filter((u) => u.includes("dsh_"))).toEqual([]); // token only in a header

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Revoke link Board" }).click();
  await page
    .getByRole("dialog", { name: "Revoke Board?" })
    .getByRole("button", { name: "Revoke" })
    .click();
  await expect(page.getByText("Revoked")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText("This link does not work")).toBeVisible();
});

test("members: an owner creates a user who must set a password; the audit log lists it", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const { orgId } = await newProject(page, `E2E Members ${run}`);
  const email = `e2e-new-${run}@example.com`;
  await page.goto(`${DASHBOARD_URL}/organizations/${orgId}/settings/members`);
  const form = page.getByRole("region", { name: "Create user" });
  await form.getByLabel("Email").fill(email);
  await form.getByRole("button", { name: "Create user" }).click();
  const password = (await page.getByRole("dialog").locator("code").textContent()) ?? "";
  expect(password.length).toBeGreaterThanOrEqual(12);

  const fresh = await (await browser.newContext({ locale: "en-US" })).newPage();
  const login = await fresh.request.post(api("/auth/login"), {
    data: { email, password },
    headers,
  });
  expect(login.status()).toBe(200);
  await fresh.goto(`${DASHBOARD_URL}/`);
  await expect(fresh.getByRole("heading", { name: "Choose your password" })).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByText("Created a user").first()).toBeVisible();
});

test("platform admin: creates an organization and its owner; an owner finds no admin area", async ({
  page,
  browser,
}) => {
  await signIn(page, "admin");
  const org = `E2E Org ${run}`;
  await page.goto(`${DASHBOARD_URL}/admin/organizations`);
  await page.getByLabel("Organization name").fill(org);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.getByRole("button", { name: `Create an owner for ${org}` }).click();
  const dialog = page.getByRole("dialog", { name: `Create an owner for ${org}` });
  await dialog.getByLabel("Email").fill(`e2e-owner-${run}@example.com`);
  await dialog.getByRole("button", { name: "Create owner" }).click();
  await expect(dialog.locator("code")).toHaveText(/\S{12,}/);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Instance" }).click();
  await expect(page.getByText("PostgreSQL")).toBeVisible();

  const owner = await (await browser.newContext({ locale: "en-US" })).newPage();
  await signIn(owner);
  await owner.goto(`${DASHBOARD_URL}/admin/organizations`);
  await expect(owner.getByText("Page not found")).toBeVisible();
});
