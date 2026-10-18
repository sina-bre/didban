import { describe, expect, it } from "vitest";
import { assignVisits } from "./assign-visits.js";
import { summarizeVisits, type VisitEvent } from "./summarize-visits.js";

// Spec §4 visit rules, pure: timeout gaps, out-of-order input, stored visits, first-touch.

const MIN = 60_000;
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 18, 12, 0) + minutes * MIN);
let next = 0;
const options = { timeoutMs: 30 * MIN, newId: () => `v${++next}` };

describe("assignVisits", () => {
  it("splits on a gap above the timeout, keeps ≤ timeout together, per visitor", () => {
    next = 0;
    const ids = assignVisits(
      [
        { visitorKey: "a", occurredAt: at(0) },
        { visitorKey: "a", occurredAt: at(30) },
        { visitorKey: "a", occurredAt: at(61) },
        { visitorKey: "b", occurredAt: at(30) },
      ],
      new Map(),
      options,
    );
    expect(ids).toEqual(["v1", "v1", "v3", "v2"]); // IDs are minted in time order
  });

  it("orders by time first, so input order does not change the split", () => {
    next = 0;
    const events = [at(61), at(0), at(30)].map((occurredAt) => ({ visitorKey: "a", occurredAt }));
    expect(assignVisits(events, new Map(), options)).toEqual(["v2", "v1", "v1"]);
  });

  it("joins stored visits, including an older one for a late event", () => {
    next = 0;
    const known = new Map([
      [
        "a",
        [
          { visitId: "new", startedAt: at(100), lastSeenAt: at(110) },
          { visitId: "old", startedAt: at(0), lastSeenAt: at(5) },
        ],
      ],
    ]);
    const events = [at(20), at(120), at(300)].map((occurredAt) => ({
      visitorKey: "a",
      occurredAt,
    }));
    expect(assignVisits(events, known, options)).toEqual(["old", "new", "v1"]);
  });
});

const base: Omit<VisitEvent, "occurredAt" | "isPage" | "pathname"> = {
  visitId: "v",
  referrerSource: null,
  channel: 0,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  country: "DE",
  browser: "Chrome",
  os: "Windows",
  deviceType: 1,
};

describe("summarizeVisits", () => {
  it("counts pages and events, entry/exit from page events, first-touch from the first page", () => {
    const [summary] = summarizeVisits([
      {
        ...base,
        isPage: false,
        occurredAt: at(0),
        pathname: "/t",
        referrerSource: "Bing",
        channel: 1,
      },
      {
        ...base,
        isPage: true,
        occurredAt: at(2),
        pathname: "/b",
        referrerSource: "Google",
        channel: 1,
      },
      { ...base, isPage: true, occurredAt: at(1), pathname: "/a", utmSource: "news", channel: 4 },
    ]);
    expect(summary).toMatchObject({
      startedAt: at(0),
      lastSeenAt: at(2),
      entryPathname: "/a",
      exitPathname: "/b",
      pageviews: 2,
      events: 3,
      utmSource: "news",
      channel: 4,
      referrerSource: null,
    });
  });

  it("leaves entry and exit empty for a visit without page events", () => {
    const [summary] = summarizeVisits([
      { ...base, isPage: false, occurredAt: at(0), pathname: "/" },
    ]);
    expect(summary).toMatchObject({
      entryPathname: null,
      exitPathname: null,
      pageviews: 0,
      events: 1,
    });
  });
});
