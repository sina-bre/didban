import { describe, expect, it } from "vitest";
import { daysBetween, intervalChoices, readInterval } from "../src/shared/lib/interval";
import { readFilters, withEquals, withFilters } from "../src/shared/lib/url-filters";

const params = (search: string) => new URLSearchParams(search);

describe("filters in the URL", () => {
  it("reads valid filters in order and drops broken and repeated ones", () => {
    const url = params(
      "filter=country:eq:DE&filter=nope:eq:x&filter=browser:in:Chrome|Firefox&filter=country:eq:DE&filter=os:eq:",
    );
    expect(readFilters(url)).toEqual([
      { field: "country", op: "eq", values: ["DE"] },
      { field: "browser", op: "in", values: ["Chrome", "Firefox"] },
    ]);
  });

  it("keeps a property filter and a value with colons", () => {
    expect(readFilters(params("filter=prop.plan:eq:pro:annual"))).toEqual([
      { field: "prop.plan", op: "eq", values: ["pro:annual"] },
    ]);
  });

  it("stops at the API's 10 filters", () => {
    const many = Array.from({ length: 12 }, (_, i) => `filter=route:eq:/p${i}`).join("&");
    expect(readFilters(params(many))).toHaveLength(10);
  });

  it("replaces the filters and leaves range, compare and the rest alone", () => {
    const next = withFilters(params("range=7d&filter=os:eq:iOS&compare=previous_period"), [
      { field: "country", op: "eq", values: ["IR"] },
    ]);
    expect(next.toString()).toBe("range=7d&compare=previous_period&filter=country%3Aeq%3AIR");
  });

  it("withEquals adds `field is value` once", () => {
    const once = withEquals(params("range=7d"), "browser", "Chrome");
    expect(once.getAll("filter")).toEqual(["browser:eq:Chrome"]);
    expect(withEquals(once, "browser", "Chrome").getAll("filter")).toEqual(["browser:eq:Chrome"]);
  });
});

describe("interval choices", () => {
  it("offers only intervals that fit the range", () => {
    expect(intervalChoices(1)).toEqual(["auto", "hour"]);
    expect(intervalChoices(7)).toEqual(["auto", "hour", "day"]);
    expect(intervalChoices(30)).toEqual(["auto", "day", "week"]);
    expect(intervalChoices(90)).toEqual(["auto", "day", "week", "month"]);
    expect(intervalChoices(366)).toEqual(["auto", "day", "week", "month"]);
  });

  it("an interval that does not fit the range reads as auto", () => {
    expect(readInterval(params("interval=week"), 30)).toBe("week");
    expect(readInterval(params("interval=hour"), 30)).toBe("auto");
    expect(readInterval(params("interval=minute"), 1)).toBe("auto");
  });

  it("counts whole days, also across a DST change", () => {
    expect(daysBetween("2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z")).toBe(30);
    // Tehran has no DST; Berlin's 25-hour day still counts as one.
    expect(daysBetween("2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z")).toBe(1);
  });
});
