import { describe, expect, it } from "vitest";
import { propertiesSchema } from "../src/index.js";

const ok = (input: unknown) => propertiesSchema.safeParse(input).success;

describe("propertiesSchema", () => {
  it("accepts flat scalar values", () => {
    expect(ok({ method: "email", seats: 3, trial: false, coupon: null })).toBe(true);
  });

  it("rejects nesting and arrays (ADR 0013)", () => {
    expect(ok({ plan: { name: "pro" } })).toBe(false);
    expect(ok({ tags: ["a", "b"] })).toBe(false);
  });

  it("enforces key format, key count and value length", () => {
    expect(ok({ "bad-key": 1 })).toBe(false);
    expect(ok({ _private: 1 })).toBe(false);
    expect(ok(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i])))).toBe(false);
    expect(ok({ note: "x".repeat(256) })).toBe(false);
  });

  it("rejects numbers outside the safe-integer range", () => {
    expect(ok({ n: Number.MAX_SAFE_INTEGER })).toBe(true);
    expect(ok({ n: Number.MAX_SAFE_INTEGER * 2 })).toBe(false);
    expect(ok({ n: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("allows only $revenue and $currency as reserved keys", () => {
    expect(ok({ $revenue: 49.9, $currency: "EUR" })).toBe(true);
    expect(ok({ $revenue: -10, $currency: "USD" })).toBe(true);
    expect(ok({ $revenue: 2e9, $currency: "USD" })).toBe(false);
    expect(ok({ $revenue: "49.90", $currency: "USD" })).toBe(false);
    expect(ok({ $revenue: 1, $currency: "usd" })).toBe(false);
    expect(ok({ $plan: "pro" })).toBe(false);
  });

  it("allows $revenue without $currency (server drops and counts it, spec §6.2)", () => {
    expect(ok({ $revenue: 10 })).toBe(true);
  });
});
