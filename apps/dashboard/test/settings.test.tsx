import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeApi } from "./fake-api";
import { ORG, orgs, PROJECT, project, projects, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { MEMBER, settingsApi } from "./settings-fixtures";

// Stage 5e project settings in jsdom: forms send what the contract expects; access gates.
const base = `/projects/${PROJECT}/settings`;
const wait = { timeout: 8000 };
const api = (extra = {}) => fakeApi({ ...signedIn(), ...settingsApi(), ...extra });
const sent = (calls: Call[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.url.pathname.endsWith(path));
/** An org `member` with this project role (spec §11: project admins manage, viewers do not). */
const asMember = (role: "viewer" | "project_admin") => ({
  "GET /organizations": {
    organizations: orgs.organizations.map((o) => ({ ...o, role: "member" })),
  },
  "GET /projects": { projects: projects.projects.map((p) => ({ ...p, role })) },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("access", () => {
  it("a viewer gets the 403 state and no form", async () => {
    api(asMember("viewer"));
    renderApp(`${base}/general`);
    expect(await screen.findByText("No access", {}, wait)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("a project admin manages the project but has no audit tab; an owner has it", async () => {
    api(asMember("project_admin"));
    renderApp(`${base}/general`);
    const nav = await screen.findByRole("navigation", { name: "Settings" }, wait);
    expect(within(nav).getByRole("link", { name: "Keys" })).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Audit log" })).toBeNull();
    cleanup();
    api();
    renderApp(`${base}/general`);
    const ownerNav = await screen.findByRole("navigation", { name: "Settings" }, wait);
    expect(within(ownerNav).getByRole("link", { name: "Audit log" })).toBeTruthy();
  });
});

describe("general and data", () => {
  it("saves typed values (number, switches) with PATCH and says so", async () => {
    const calls = api({
      [`PATCH /projects/${PROJECT}`]: { ...project(), sessionTimeoutMinutes: 45 },
    });
    renderApp(`${base}/general`);
    const timeout = await screen.findByLabelText("Visit timeout (minutes)", {}, wait);
    fireEvent.change(timeout, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("switch", { name: /Allow identify/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved", {}, wait)).toBeTruthy();
    expect(sent(calls, "PATCH", `/projects/${PROJECT}`)[0]?.body).toEqual({
      name: "Shop",
      reportingTimezone: "UTC",
      sessionTimeoutMinutes: 45,
      trailingSlashPolicy: "strip",
      hashRouting: false,
      allowIdentify: true,
    });
  });

  it("an out-of-range value is refused in the browser, nothing is sent", async () => {
    const calls = api();
    renderApp(`${base}/general`);
    fireEvent.change(await screen.findByLabelText("Visit timeout (minutes)", {}, wait), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Check this value.", {}, wait)).toBeTruthy();
    expect(sent(calls, "PATCH", `/projects/${PROJECT}`)).toEqual([]);
  });

  it("data: empty retention keeps forever (null), lists split on commas", async () => {
    const calls = api({ [`PATCH /projects/${PROJECT}`]: project() });
    renderApp(`${base}/data`);
    fireEvent.change(await screen.findByLabelText("URL parameters to keep", {}, wait), {
      target: { value: "utm_id, ref ref" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved", {}, wait);
    expect(sent(calls, "PATCH", `/projects/${PROJECT}`)[0]?.body).toMatchObject({
      retentionDays: null,
      urlParamAllowlist: ["utm_id", "ref"],
      piiGuard: "strip",
    });
    expect(screen.getByRole("button", { name: "Archive project" })).toBeTruthy();
  });
});

describe("routes, members, audit", () => {
  it("adds a template and previews paths against the saved ones", async () => {
    const calls = api({
      [`POST /projects/${PROJECT}/routes`]: () => ({ status: 201, body: {} }),
      [`POST /projects/${PROJECT}/routes/preview`]: {
        results: [
          { path: "/products/42", template: "/products/:id" },
          { path: "/about", template: null },
        ],
      },
    });
    renderApp(`${base}/routes`);
    fireEvent.change(await screen.findByLabelText("Template", {}, wait), {
      target: { value: "/blog/*" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add template" }));
    await waitFor(() =>
      expect(sent(calls, "POST", "/routes")[0]?.body).toEqual({ pattern: "/blog/*" }),
    );
    fireEvent.change(screen.getByLabelText("Paths"), {
      target: { value: "/products/42\n/about\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Try paths" }));
    const result = await screen.findByRole("table", { name: "Matches" }, wait);
    expect(within(result).getByText("As it is")).toBeTruthy();
    expect(sent(calls, "POST", "/routes/preview")[0]?.body).toEqual({
      paths: ["/products/42", "/about"],
    });
  });

  it("gives an org member a project role with PUT", async () => {
    const calls = api({ [`PUT /projects/${PROJECT}/members/${MEMBER}`]: () => ({ status: 204 }) });
    renderApp(`${base}/members`);
    fireEvent.change(await screen.findByLabelText("Role", {}, wait), {
      target: { value: "project_admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Give access" }));
    await waitFor(() =>
      expect(sent(calls, "PUT", `/members/${MEMBER}`)[0]?.body).toEqual({ role: "project_admin" }),
    );
  });

  it("project audit: only this project's entries, older pages by keyset", async () => {
    const calls = api();
    renderApp(`${base}/audit`);
    expect(await screen.findByText("Created a share link", {}, wait)).toBeTruthy();
    expect(
      sent(calls, "GET", `/organizations/${ORG}/audit-log`)[0]?.url.searchParams.get("projectId"),
    ).toBe(PROJECT);
    fireEvent.click(screen.getByRole("button", { name: "Show older entries" }));
    expect(await screen.findByText("Revoked a key", {}, wait)).toBeTruthy();
    expect(sent(calls, "GET", "/audit-log").at(-1)?.url.searchParams.get("before")).toBe("12");
    expect(screen.queryByRole("button", { name: "Show older entries" })).toBeNull();
  });
});
