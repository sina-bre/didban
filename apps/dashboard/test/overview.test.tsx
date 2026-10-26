import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, fakeApi } from "./fake-api";
import { OTHER, PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { emptyOverview } from "./stats-fixtures";

const base = `/projects/${PROJECT}`;
const kpis = () => screen.findByRole("region", { name: "Key metrics" }, { timeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Overview", () => {
  it("formats the six KPIs and asks for the URL's range in the project's zone", async () => {
    const calls = fakeApi(signedIn());
    renderApp(`${base}/overview?from=2026-10-01&to=2026-10-03`);
    const card = await kpis();
    await within(card).findByText("1,234");
    for (const text of ["1,500", "4,200", "2.8", "42%", "1 min 23 sec"]) {
      expect(within(card).getAllByText(text).length).toBeGreaterThan(0);
    }
    const sent = calls.find((c) => c.url.pathname.endsWith("/stats/overview"));
    expect(Object.fromEntries(sent?.url.searchParams ?? [])).toEqual({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-04T00:00:00.000Z",
      compare: "none",
    });
    expect(screen.getByText(/Cookieless mode/)).toBeTruthy();
  });

  it("the compare switch writes the URL, sends compare and shows deltas", async () => {
    const calls = fakeApi(signedIn());
    const { router } = renderApp(`${base}/overview?range=7d`);
    const card = await kpis();
    await within(card).findByText("1,234");
    expect(within(card).queryByText("+12.5%")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Compare with previous period" }));
    expect(router.state.location.search).toBe("?range=7d&compare=previous_period");
    await within(card).findByText("+12.5%");
    expect(within(card).getAllByText("—").length).toBeGreaterThan(0); // change null → "—"
    const compared = calls.filter((c) => c.url.searchParams.get("compare") === "previous_period");
    expect(compared.map((c) => c.url.pathname.split("/").pop())).toEqual(
      expect.arrayContaining(["overview", "timeseries"]),
    );
  });
});

describe("Overview cards and states", () => {
  it("channels read in the user's words with their share of visits", async () => {
    fakeApi(signedIn());
    renderApp(`${base}/overview`);
    const channels = await screen.findByRole("region", { name: "Channels" }, { timeout: 5000 });
    expect(within(channels).getByText("Organic search")).toBeTruthy();
    expect(within(channels).getByText("75%")).toBeTruthy();
  });

  it("no events in the range: the empty state instead of zeros", async () => {
    fakeApi({ ...signedIn(), [`GET ${base}/stats/overview`]: emptyOverview });
    renderApp(`${base}/overview`);
    expect(await screen.findByText("No data yet", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Channels" })).toBeNull();
  });

  it("a failed request shows the error with its request ID and retries", async () => {
    let fail = true;
    fakeApi({
      ...signedIn(),
      [`GET ${base}/stats/overview`]: () =>
        fail ? apiError(503, "SERVICE_UNAVAILABLE") : { body: emptyOverview },
    });
    renderApp(`${base}/overview`);
    const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(alert.textContent).toContain("req-test");
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No data yet")).toBeTruthy();
  });
});

describe("projects and the switcher", () => {
  it("a missing or forbidden project renders not found (the API answers 404 for both)", async () => {
    fakeApi(signedIn());
    renderApp("/projects/00000000-0000-4000-8000-00000000dead/overview");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Switch organization/ })).toBeNull();
  });

  it("names the current org and project; links to the user's other projects", async () => {
    fakeApi(signedIn());
    renderApp(`${base}/overview`);
    const trigger = await screen.findByRole(
      "button",
      { name: /Switch organization and project: Acme \/ Shop/ },
      { timeout: 5000 },
    );
    expect(trigger).toBeTruthy();
    // Opening and following a link needs the Popover API: switcher.browser.tsx (real Chrome).
    expect(screen.getByRole("link", { name: "Blog", hidden: true }).getAttribute("href")).toBe(
      `/projects/${OTHER}/overview`,
    );
  });
});
