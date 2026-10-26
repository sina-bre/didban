import { expect, type Page } from "@playwright/test";
import { projectIdOf } from "./db.js";
import { DASHBOARD_URL, PROJECTS, USERS } from "./keys.js";

// Shared by the dashboard specs: a session without the login form, and the seeded project's URL.

/** Signs in through the API (same origin, like the form); the cookie lands in the page's context. */
export async function signIn(page: Page, user: keyof typeof USERS = "owner"): Promise<void> {
  const response = await page.request.post(`${DASHBOARD_URL}/api/v1/auth/login`, {
    data: USERS[user],
    headers: { origin: DASHBOARD_URL },
  });
  expect(response.status()).toBe(200);
}

/** `/projects/<id>` of the Vite example's project. */
export async function projectBase(): Promise<string> {
  return `${DASHBOARD_URL}/projects/${await projectIdOf(PROJECTS.vite.slug)}`;
}

/** Hosts other than the dashboard itself that the page talked to (must stay empty). */
export function externalHosts(page: Page): Set<string> {
  const hosts = new Set<string>();
  page.on("request", (req) => {
    const { host } = new URL(req.url());
    if (host !== new URL(DASHBOARD_URL).host && !req.url().startsWith("data:")) hosts.add(host);
  });
  return hosts;
}
