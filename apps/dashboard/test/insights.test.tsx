import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeApi } from "./fake-api";
import { orgs, PROJECT, projects, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { dataHealth, reports } from "./report-fixtures";

const base = `/projects/${PROJECT}`;
const wait = { timeout: 5000 };
const api = (extra = {}) => fakeApi({ ...signedIn(), ...reports(), ...extra });
const last = (calls: Call[], path: string) =>
  calls.filter((c) => c.url.pathname.endsWith(path)).at(-1)?.url.searchParams;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Pages", () => {
  it("top pages link to their detail with the range kept; views switch by URL", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/pages?range=7d`);
    const top = await screen.findByRole("table", { name: "Top pages" }, wait);
    const link = within(top).getByRole("link", { name: /\/products\/:id/ });
    expect(link.getAttribute("href")).toBe(
      `${base}/pages/detail?range=7d&hostname=shop.example&route=%2Fproducts%2F%3Aid`,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Entry pages" }));
    expect(router.state.location.search).toBe("?range=7d&view=entry");
    const entry = await screen.findByRole("table", { name: "Entry pages" }, wait);
    expect(within(entry).getByRole("link", { name: "Filter by /landing" })).toBeTruthy();
    expect(last(calls, "/stats/pages")?.get("view")).toBe("entry");
    fireEvent.click(screen.getByRole("radio", { name: "Discovered pages" }));
    const found = await screen.findByRole("table", { name: "Discovered pages" }, wait);
    expect(within(found).getByText("Autumn sale")).toBeTruthy();
    expect(within(found).getByText("Oct 20")).toBeTruthy();
  });

  it("the detail view shows the page's numbers and scroll depth, and keeps the nav", async () => {
    const calls = api();
    renderApp(`${base}/pages/detail?hostname=shop.example&route=%2Fproducts%2F%3Aid`);
    expect(await screen.findByRole("heading", { level: 1, name: "/products/:id" }, wait));
    expect((await screen.findAllByText("42 sec", {}, wait)).length).toBeGreaterThan(0);
    const scroll = screen.getByRole("region", { name: "Scroll depth" });
    expect(within(scroll).getByText("Reached 100%")).toBeTruthy();
    expect(last(calls, "/stats/pages/detail")?.get("route")).toBe("/products/:id");
    expect(screen.getAllByRole("link", { name: "Pages" }).length).toBeGreaterThan(0);
  });
});

describe("Events", () => {
  it("event → its property keys → a key's values → a property filter, all in the URL", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/events`);
    const list = await screen.findByRole("table", { name: "Custom events" }, wait);
    expect(screen.getByText("Pick an event to see its properties.")).toBeTruthy();
    fireEvent.click(within(list).getByRole("link", { name: "signup" }));
    expect(router.state.location.search).toBe("?event=signup");
    const keys = await screen.findByRole("table", { name: "Properties of signup" }, wait);
    fireEvent.click(within(keys).getByRole("link", { name: "plan" }));
    const values = await screen.findByRole("table", { name: "Values of plan" }, wait);
    expect(last(calls, "/stats/events/signup/properties")?.get("key")).toBe("plan");
    fireEvent.click(within(values).getByRole("link", { name: "Filter by pro" }));
    expect(new URLSearchParams(router.state.location.search).getAll("filter")).toEqual([
      "prop.plan:eq:pro",
    ]);
    expect(await screen.findByText("Property plan is pro")).toBeTruthy();
  });

  it("an invalid ?event= is ignored, nothing is requested for it", async () => {
    const calls = api();
    renderApp(`${base}/events?event=${encodeURIComponent("<script>")}`);
    await screen.findByRole("table", { name: "Custom events" }, wait);
    expect(calls.some((c) => c.url.pathname.includes("/properties"))).toBe(false);
  });
});

describe("Goals", () => {
  it("conversions, browser-only rate and revenue per currency; managers see the controls", async () => {
    api();
    renderApp(`${base}/goals`);
    const goals = await screen.findByRole("table", { name: "Goals" }, wait);
    for (const text of ["Signed up", "signup", "7", "12.5%", "€49.90"]) {
      expect(within(goals).getByText(text)).toBeTruthy();
    }
    expect(await screen.findByRole("button", { name: "Add goal" })).toBeTruthy();
    expect(within(goals).getByRole("button", { name: "Delete goal Signed up" })).toBeTruthy();
  });

  it("a member viewer gets no add or delete", async () => {
    const member = { organizations: [{ ...orgs.organizations[0], role: "member" }] };
    const viewer = projects.projects.map((p) => ({ ...p, role: "viewer" }));
    api({ "GET /organizations": member, "GET /projects": { projects: viewer } });
    renderApp(`${base}/goals`);
    await screen.findByRole("table", { name: "Goals" }, wait);
    // The switcher (same lists as the role check) has loaded.
    await waitFor(() => expect(screen.queryAllByText(/Acme/).length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Add goal" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete goal/ })).toBeNull();
  });
});

describe("Data health", () => {
  it("last event, rejections by code and origin, the overflow warning", async () => {
    api();
    renderApp(`${base}/data-health`);
    expect(await screen.findByTestId("last-event", {}, wait)).toHaveProperty(
      "textContent",
      "Oct 26, 9:58 AM",
    );
    expect(screen.getAllByText("ORIGIN_NOT_ALLOWED").length).toBe(2);
    expect(screen.getAllByText("https://evil.example").length).toBe(2);
    const statuses = screen.getAllByRole("status").map((el) => el.textContent);
    expect(statuses.some((text) => text?.includes("/__other__"))).toBe(true);
  });

  it("no event yet: says so and where to look", async () => {
    api({ [`GET ${base}/stats/data-health`]: { ...dataHealth, lastEventAt: null } });
    renderApp(`${base}/data-health`);
    expect(await screen.findByText("None yet", {}, wait)).toBeTruthy();
    expect(screen.getByText(/Check the write key, the allowed origins/)).toBeTruthy();
  });
});
