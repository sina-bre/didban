import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { likelyCause } from "../src/features/integration/likely-cause";
import { apiError, fakeApi, type Handler } from "./fake-api";
import { me, ORG, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { dataHealth } from "./report-fixtures";
import { settingsApi } from "./settings-fixtures";
import { channels, overview, timeseries } from "./stats-fixtures";

// Share view, platform admin, organization settings and the projects list (spec §13.3).
const wait = { timeout: 8000 };
const TOKEN = `dsh_${"t".repeat(43)}`;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

/** Answers only with the share token in its header (never in the URL, ADR 0036). */
const shared =
  (body: unknown): Handler =>
  (url, init) => {
    const header = (init.headers as Record<string, string>)["x-share-token"];
    return header === TOKEN && !url.search.includes(TOKEN) ? { body } : apiError(404, "NOT_FOUND");
  };

describe("/share", () => {
  it("reads the token from the fragment, sends it as a header, shows the overview", async () => {
    history.replaceState(null, "", `/share#${TOKEN}`);
    const calls = fakeApi({
      "GET /share": shared({ projectName: "Shop", label: "Board", timezone: "UTC" }),
      "GET /share/stats/overview": shared(overview),
      "GET /share/stats/timeseries": shared(timeseries),
      "GET /share/stats/sources": shared(channels),
    });
    renderApp("/share");
    expect(await screen.findByText("Shop · Board", {}, wait)).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" }, wait)).toBeTruthy();
    expect((await screen.findAllByText("Visitors", {}, wait)).length).toBeGreaterThan(0);
    expect(calls.some((c) => c.url.pathname.includes("/projects"))).toBe(false); // no session API
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  it("a revoked or unknown link looks missing", async () => {
    history.replaceState(null, "", `/share#${TOKEN}`);
    fakeApi({ "GET /share": () => apiError(404, "NOT_FOUND") });
    renderApp("/share");
    expect(await screen.findByText("This link does not work", {}, wait)).toBeTruthy();
  });
});

describe("platform admin", () => {
  it("is not found for everyone else", async () => {
    fakeApi({ ...signedIn(), ...settingsApi() });
    renderApp("/admin/instance");
    expect(await screen.findByText("Page not found", {}, wait)).toBeTruthy();
  });

  it("shows instance health and organization counts to a platform admin", async () => {
    const admin = me();
    admin.user.isPlatformAdmin = true;
    fakeApi({ ...signedIn(), ...settingsApi(), "GET /auth/me": admin });
    const { router } = renderApp("/admin/instance");
    expect((await screen.findAllByText("77", {}, wait)).length).toBeGreaterThan(0);
    expect(screen.getByText("50 MB")).toBeTruthy();
    await router.navigate("/admin/organizations");
    const table = await screen.findByRole("table", { name: "Organizations" }, wait);
    expect(within(table).getByText("1,234")).toBeTruthy();
  });
});

describe("organization settings and /projects", () => {
  it("owners see members with the temporary-password state; members get not found", async () => {
    fakeApi({ ...signedIn(), ...settingsApi() });
    renderApp(`/organizations/${ORG}/settings/members`);
    const table = await screen.findByRole("table", { name: "Members" }, wait);
    expect(within(table).getByText("Temporary password")).toBeTruthy();
    expect(
      within(table).getByRole("button", { name: "Reset the password of m@example.com" }),
    ).toBeTruthy();
    cleanup();
    fakeApi({
      ...signedIn(),
      "GET /organizations": {
        organizations: [{ id: ORG, name: "Acme", slug: "acme", role: "member" }],
      },
    });
    renderApp(`/organizations/${ORG}/settings/members`);
    expect(await screen.findByText("Page not found", {}, wait)).toBeTruthy();
  });

  it("/projects lists projects by organization with New project for owners", async () => {
    fakeApi(signedIn());
    renderApp("/projects");
    const org = await screen.findByRole("region", { name: "Acme" }, wait);
    expect(within(org).getByRole("link", { name: "Shop" }).getAttribute("href")).toMatch(
      /overview$/,
    );
    expect(within(org).getByRole("link", { name: "New project" }).getAttribute("href")).toBe(
      `/projects/new?org=${ORG}`,
    );
  });
});

describe("likelyCause (spec §13.4)", () => {
  const base = { ...dataHealth, rejections: [], rejectedOrigins: [], recentRejections: [] };
  it("prefers the newest rejected batch, then the top code, then a rejected origin", () => {
    expect(likelyCause(base)).toBeNull();
    const origin = {
      origin: "https://a.example",
      count: 3,
      lastSeenAt: "2026-10-20T10:00:00.000Z",
    };
    expect(likelyCause({ ...base, rejectedOrigins: [origin] })).toEqual({
      code: "ORIGIN_NOT_ALLOWED",
      origin: "https://a.example",
    });
    const codes = [
      { code: "RATE_LIMITED", count: 2 },
      { code: "ORIGIN_NOT_ALLOWED", count: 9 },
    ];
    expect(likelyCause({ ...base, rejections: codes, rejectedOrigins: [origin] })).toEqual({
      code: "ORIGIN_NOT_ALLOWED",
      origin: "https://a.example",
    });
    const recent = [{ at: "2026-10-20T10:00:00.000Z", code: "INTERNAL_TRAFFIC", origin: null }];
    expect(likelyCause({ ...base, rejections: codes, recentRejections: recent })).toEqual({
      code: "INTERNAL_TRAFFIC",
      origin: null,
    });
  });
});
