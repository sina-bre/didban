import { describe, expect, it } from "vitest";
import { DEFAULT_RANGE, rangeBounds, readRange } from "../src/shared/lib/url-state";

describe("readRange", () => {
  it("defaults to 30 days (90-day reports are slow at 10 M events)", () => {
    expect(DEFAULT_RANGE).toBe("30d");
    expect(readRange(new URLSearchParams())).toBe("30d");
  });

  it("reads a known preset and ignores anything else", () => {
    expect(readRange(new URLSearchParams("range=7d"))).toBe("7d");
    expect(readRange(new URLSearchParams("range=365d"))).toBe("30d");
  });
});

describe("rangeBounds", () => {
  const now = new Date(2026, 9, 19, 15, 30);

  it("starts at local midnight days - 1 days ago and ends now", () => {
    const { from, to } = rangeBounds("30d", now);
    expect(from).toEqual(new Date(2026, 8, 20, 0, 0));
    expect(to).toBe(now);
  });

  it("today starts at local midnight", () => {
    expect(rangeBounds("today", now).from).toEqual(new Date(2026, 9, 19, 0, 0));
  });
});
