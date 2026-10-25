import { describe, expect, it } from "vitest";
import { type BreakdownRow, sortRows } from "../src/shared/components/breakdown-table";
import { formatNumber, formatPercent } from "../src/shared/lib/format";
import { tabIndexFor } from "../src/shared/ui/tabs";

describe("format", () => {
  it("formats counts in full or compact", () => {
    expect(formatNumber("en", 12_400)).toBe("12,400");
    expect(formatNumber("en", 12_400, true)).toBe("12.4K");
    expect(formatNumber("fa", 30)).toBe("۳۰");
  });

  it("signs deltas, but not zero", () => {
    expect(formatPercent("en", 0.011, true)).toBe("+1.1%");
    expect(formatPercent("en", -0.004, true)).toBe("-0.4%");
    expect(formatPercent("en", 0, true)).toBe("0%");
    expect(formatPercent("en", 0.25)).toBe("25%");
  });
});

describe("tabIndexFor", () => {
  it("ArrowRight is next in ltr and previous in rtl", () => {
    expect(tabIndexFor("ArrowRight", false, 0, 3)).toBe(1);
    expect(tabIndexFor("ArrowRight", true, 0, 3)).toBe(2);
    expect(tabIndexFor("ArrowLeft", true, 2, 3)).toBe(0);
  });

  it("Home/End jump; other keys do nothing", () => {
    expect(tabIndexFor("End", false, 0, 3)).toBe(2);
    expect(tabIndexFor("Home", true, 2, 3)).toBe(0);
    expect(tabIndexFor("Enter", false, 1, 3)).toBe(-1);
  });
});

describe("sortRows", () => {
  const rows = [
    { key: "a", label: "a", sortText: "/b", values: { visitors: 5 } },
    { key: "b", label: "b", sortText: "/a", values: { visitors: 9 } },
    { key: "c", label: "c", sortText: "/c", values: { visitors: 5 } },
  ];
  const keys = (sorted: readonly BreakdownRow[]) => sorted.map((r) => r.key);

  it("sorts metrics by value and keeps the API order on ties", () => {
    expect(keys(sortRows(rows, { key: "visitors", dir: "desc" }, "en"))).toEqual(["b", "a", "c"]);
    expect(keys(sortRows(rows, { key: "visitors", dir: "asc" }, "en"))).toEqual(["a", "c", "b"]);
  });

  it("sorts the dimension by text", () => {
    expect(keys(sortRows(rows, { key: "dimension", dir: "asc" }, "en"))).toEqual(["b", "a", "c"]);
  });
});
