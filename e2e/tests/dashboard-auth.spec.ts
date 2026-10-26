import { expect, test } from "@playwright/test";
import { projectBase, signIn } from "./dashboard.js";
import { DASHBOARD_URL, USERS } from "./keys.js";

// Stage 5c: sign-in, the forced password change and the lost-session redirect, against the real
// API (Argon2id, session cookie, CSRF origin check) behind the production dashboard build.
test.use({ locale: "en-US" });

test("a deep link without a session: login, then back to the same report and range", async ({
  page,
}) => {
  const target = `${await projectBase()}/overview?range=7d`;
  await page.goto(target);
  await expect(page).toHaveURL(
    `${DASHBOARD_URL}/login?next=${encodeURIComponent(target.slice(DASHBOARD_URL.length))}`,
  );
  await page.getByLabel("Email").fill(USERS.owner.email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.");

  await page.getByLabel("Password").fill(USERS.owner.password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(target);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(
    page.getByRole("button", { name: /Switch organization and project: e2e \/ e2e-vite/ }),
  ).toBeVisible();
});

test("a temporary password must be replaced before any report", async ({ page }) => {
  await signIn(page, "fresh");
  const overview = `${await projectBase()}/overview`;
  await page.goto(overview);
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  await page.getByLabel("Temporary password").fill(USERS.fresh.password);
  await page.getByLabel("New password", { exact: true }).fill("Unbelievable");
  await page.getByLabel("Repeat the new password").fill("Unbelievable");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("This password is too common. Choose another one.")).toBeVisible();

  const mine = "a quiet harbour at dawn 42";
  await page.getByLabel("New password", { exact: true }).fill(mine);
  await page.getByLabel("Repeat the new password").fill(mine);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(overview);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
});

test("a lost session sends the next request to /login with the return path", async ({
  page,
  context,
}) => {
  await signIn(page);
  const base = await projectBase();
  await page.goto(`${base}/overview`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await context.clearCookies();
  await page.getByText("7 days", { exact: true }).click(); // a new range → new requests → 401
  await expect(page).toHaveURL(
    `${DASHBOARD_URL}/login?next=${encodeURIComponent(`${base.slice(DASHBOARD_URL.length)}/overview?range=7d`)}`,
  );
});

test("another organization's or a made-up project looks like a missing page", async ({ page }) => {
  await signIn(page);
  await page.goto(`${DASHBOARD_URL}/projects/00000000-0000-4000-8000-00000000dead/overview`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await page.goto(`${DASHBOARD_URL}/projects/not-a-uuid/overview`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});
