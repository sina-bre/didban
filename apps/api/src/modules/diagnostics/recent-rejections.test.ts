import { expect, it } from "vitest";
import { RECENT_PER_ENVIRONMENT, RecentRejections } from "./recent-rejections.js";

it("keeps the last 20 per environment, newest first, origin truncated, no payload", () => {
  let now = Date.parse("2026-10-18T10:00:00Z");
  const recent = new RecentRejections(() => now);
  for (let i = 0; i < 25; i++) {
    now += 1000;
    recent.add(
      "env-a",
      i % 2 ? "RATE_LIMITED" : "ORIGIN_NOT_ALLOWED",
      `https://${"x".repeat(300)}`,
    );
  }
  recent.add("env-b", "INVALID_ENVELOPE", undefined);
  const a = recent.list(["env-a"]);
  expect(a).toHaveLength(RECENT_PER_ENVIRONMENT);
  expect(a[0]).toEqual({
    at: "2026-10-18T10:00:25.000Z",
    code: "ORIGIN_NOT_ALLOWED",
    origin: expect.any(String),
  });
  expect(a[0]?.origin?.length).toBe(255);
  expect(Object.keys(a[0] ?? {})).toEqual(["at", "code", "origin"]);
  expect(recent.list(["env-b"])).toEqual([
    { at: "2026-10-18T10:00:25.000Z", code: "INVALID_ENVELOPE", origin: null },
  ]);
  expect(recent.list(["nope"])).toEqual([]);
});
