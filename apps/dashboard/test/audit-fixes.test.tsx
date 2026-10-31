import { QueryClient } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prefetchFirstScreen } from "../src/app/prefetch";
import { SeriesSummary, StatCard } from "../src/shared/components";
import { renderUi } from "./render";

// Stage 5f fixes from the Lighthouse and axe audit.
afterEach(cleanup);

describe("audit fixes", () => {
  it("StatCard: the number is named by its label (figure + figcaption)", () => {
    renderUi(<StatCard label="Visits" value={42} />);
    expect(screen.getByRole("figure", { name: "Visits" }).textContent).toContain("42");
  });

  it("SeriesSummary: each dl group holds only dt and dd (axe dlitem/definition-list)", () => {
    renderUi(<SeriesSummary items={[{ label: "Visitors", value: 3 }]} />);
    const groups = [...(document.querySelector("dl")?.children ?? [])];
    expect(groups.map((g) => g.tagName)).toEqual(["DIV"]);
    expect([...(groups[0]?.children ?? [])].map((c) => c.tagName)).toEqual(["DT", "DD"]);
  });
});

describe("prefetchFirstScreen", () => {
  const ID = "4ac10e17-e304-48a3-b037-3df2624e786d";
  const keys = async (pathname: string, search = "") => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "prefetchQuery").mockResolvedValue();
    vi.spyOn(client, "fetchQuery").mockResolvedValue({ reportingTimezone: "Asia/Tehran" });
    prefetchFirstScreen(client, { pathname, search } as Location);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return spy.mock.calls.map(([options]) => options.queryKey);
  };

  it("on a project's Overview asks for the session and its three reports in the project's zone", async () => {
    const asked = await keys(`/projects/${ID}/overview`, "?range=7d&compare=previous_period");
    expect(asked.map((key) => key?.slice(0, 3))).toEqual([
      ["me"],
      ["stats", ID, "overview"],
      ["stats", ID, "timeseries"],
      ["stats", ID, "sources"],
    ]);
    const query = asked[1]?.[3] as { from: string; compare: string };
    expect(query.compare).toBe("previous_period");
    expect(query.from).toMatch(/T20:30:00\.000Z$/); // midnight in Tehran
    expect(await keys(`/projects/${ID}`)).toHaveLength(4); // the index is the Overview
  });

  it("elsewhere asks for the session and the project in the URL", async () => {
    expect(await keys(`/projects/${ID}/pages`)).toEqual([["me"], ["project", ID]]);
    expect(await keys("/projects/new")).toEqual([["me"]]);
    expect(await keys("/")).toEqual([["me"]]);
  });

  it("asks nothing on the pages without a session (a 401 would leave /login)", async () => {
    for (const path of ["/login", "/set-password", "/share"]) expect(await keys(path)).toEqual([]);
  });
});
