import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeApi } from "./fake-api";
import { PROJECT, project, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { reports } from "./report-fixtures";

const base = `/projects/${PROJECT}`;
const wait = { timeout: 5000 };
const api = () => fakeApi({ ...signedIn(), ...reports() });
const sent = (calls: Call[], report: string) =>
  calls.filter((c) => c.url.pathname.endsWith(`/stats/${report}`)).map((c) => c.url.searchParams);
const table = (name: string) => screen.findByRole("table", { name }, wait);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Sources", () => {
  it("channels in the user's words with visit metrics; ?by= switches the dimension", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/sources`);
    const rows = await table("Channel");
    expect(within(rows).getByText("Organic search")).toBeTruthy();
    expect(within(rows).getByText("1 min 30 sec")).toBeTruthy(); // visit duration 90 s
    expect(within(rows).getByText("30%")).toBeTruthy(); // bounce rate 0.3
    fireEvent.click(screen.getByRole("radio", { name: "Referrer" }));
    expect(router.state.location.search).toBe("?by=referrer");
    const referrers = await table("Referrer");
    expect(within(referrers).getByText("(not set)")).toBeTruthy();
    expect(screen.getByText(/Showing the top 2/)).toBeTruthy(); // meta.truncated
    expect(sent(calls, "sources").at(-1)?.get("by")).toBe("referrer");
    expect(sent(calls, "sources").at(-1)?.get("limit")).toBe("100");
  });

  it("a row adds its filter to the URL and every request sends it", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/sources?range=7d`);
    fireEvent.click(await screen.findByRole("link", { name: "Filter by Organic search" }, wait));
    expect(router.state.location.search).toBe("?range=7d&filter=channel%3Aeq%3AorganicSearch");
    expect(await screen.findByText("Channel is Organic search")).toBeTruthy();
    await waitFor(() =>
      expect(sent(calls, "sources").at(-1)?.getAll("filter")).toEqual(["channel:eq:organicSearch"]),
    );
  });
});

describe("FilterBar bound to the URL", () => {
  it("chips come from the URL; removing one rewrites it; back restores it", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/devices?filter=country:eq:DE&filter=browser:eq:Chrome`);
    await table("Browser");
    expect(sent(calls, "devices")[0]?.getAll("filter")).toEqual([
      "country:eq:DE",
      "browser:eq:Chrome",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Country is Germany" }));
    expect(router.state.location.search).toBe("?filter=browser%3Aeq%3AChrome");
    await waitFor(() =>
      expect(sent(calls, "devices").at(-1)?.getAll("filter")).toEqual(["browser:eq:Chrome"]),
    );
    await router.navigate(-1);
    expect(await screen.findByText("Country is Germany")).toBeTruthy();
  });

  it("picking a field loads that field's values, nothing before", async () => {
    const calls = api();
    renderApp(`${base}/pages`);
    await table("Top pages");
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(sent(calls, "geo")).toEqual([]);
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "country" } });
    await waitFor(() => expect(sent(calls, "geo").at(-1)?.get("by")).toBe("country"));
    expect(await screen.findByRole("combobox", { name: "Value" }, wait)).toBeTruthy();
  });
});

describe("Geo and Devices", () => {
  it("countries by name; all-null rows say geo is not configured; city needs the setting", async () => {
    fakeApi({ ...signedIn(), ...reports() });
    const { router } = renderApp(`${base}/geo`);
    expect(within(await table("Country")).getByText("Germany")).toBeTruthy();
    await router.navigate(`${base}/geo?by=city`);
    expect(await screen.findByText("Cities are not stored")).toBeTruthy();
    cleanup();
    fakeApi({
      ...signedIn(),
      ...reports(),
      [`GET /projects/${PROJECT}`]: { ...project(), storeCity: true },
    });
    renderApp(`${base}/geo?by=city`);
    expect(await screen.findByText("Locations are not recorded", {}, wait)).toBeTruthy();
  });

  it("device types are labelled", async () => {
    api();
    renderApp(`${base}/devices?by=device_type`);
    expect(within(await table("Device type")).getByText("Mobile")).toBeTruthy();
  });
});

describe("export", () => {
  it("downloads export.csv with the report, its dimension, the range and the filters", async () => {
    api();
    renderApp(`${base}/geo?by=region&from=2026-10-01&to=2026-10-03&filter=os:eq:iOS`);
    await table("Region");
    const link = screen.getByRole("link", { name: "Export CSV" });
    const url = new URL(link.getAttribute("href") ?? "", "http://dashboard.test");
    expect(url.pathname).toBe(`/api/v1/projects/${PROJECT}/stats/export.csv`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      report: "geo",
      by: "region",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-04T00:00:00.000Z",
      filter: "os:eq:iOS",
    });
    expect(link.hasAttribute("download")).toBe(true);
  });
});

describe("Overview interval", () => {
  it("only fitting intervals; the choice goes to the URL and to the time series only", async () => {
    const calls = api();
    const { router } = renderApp(`${base}/overview?range=30d`);
    const group = await screen.findByRole("group", { name: "Interval" }, wait);
    const names = within(group)
      .getAllByRole("radio")
      .map((r) => r.closest("label")?.textContent);
    expect(names).toEqual(["Auto", "Daily", "Weekly"]);
    fireEvent.click(within(group).getByRole("radio", { name: "Weekly" }));
    expect(router.state.location.search).toBe("?range=30d&interval=week");
    await waitFor(() => expect(sent(calls, "timeseries").at(-1)?.get("interval")).toBe("week"));
    expect(sent(calls, "overview").every((q) => !q.has("interval"))).toBe(true);
  });
});
