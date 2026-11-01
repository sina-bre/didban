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

  it("on a project's Overview asks for its three reports together with the project", async () => {
    const asked = await keys(`/projects/${ID}/overview`, "?range=7d&compare=previous_period");
    expect(asked.map((key) => key?.slice(0, 3))).toEqual([
      ["me"],
      ["project", ID],
      ["stats", ID, "overview"],
      ["stats", ID, "timeseries"],
      ["stats", ID, "sources"],
    ]);
    // A preset needs no zone: the API resolves `range` in the project's (ADR 0046).
    expect(asked[2]?.[3]).toMatchObject({ range: "7d", compare: "previous_period" });
    expect(await keys(`/projects/${ID}`)).toHaveLength(5); // the index is the Overview
  });

  it("a custom range waits for the project's zone", async () => {
    const asked = await keys(`/projects/${ID}`, "?from=2026-10-01&to=2026-10-07");
    expect(asked.map((key) => key?.slice(0, 3))).toEqual([
      ["me"],
      ["stats", ID, "overview"],
      ["stats", ID, "timeseries"],
      ["stats", ID, "sources"],
    ]);
    expect(asked[1]?.[3]).toMatchObject({ from: "2026-09-30T20:30:00.000Z" }); // Tehran midnight
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
