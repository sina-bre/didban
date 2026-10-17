import { z } from "zod";
import { CURRENCY_PATTERN, LIMITS, PROPERTY_KEY_PATTERN, RESERVED_PROPERTIES } from "./limits.js";

// Spec §6.2 + ADR 0013: flat values only, no nesting.
export const propertyValueSchema = z.union([
  z.string().max(LIMITS.maxPropertyStringLength),
  z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  z.boolean(),
  z.null(),
]);

function reservedIssue(key: string, value: unknown): string | null {
  if (key === RESERVED_PROPERTIES.revenue) {
    const ok = typeof value === "number" && Math.abs(value) <= LIMITS.maxRevenueAbs;
    return ok ? null : "$revenue must be a number with absolute value <= 1e9";
  }
  if (key === RESERVED_PROPERTIES.currency) {
    const ok = typeof value === "string" && CURRENCY_PATTERN.test(value);
    return ok ? null : "$currency must be a 3-letter uppercase ISO 4217 code";
  }
  return "unknown reserved property";
}

function keyIssue(key: string, value: unknown): string | null {
  if (key.startsWith("$")) return reservedIssue(key, value);
  return PROPERTY_KEY_PATTERN.test(key) ? null : "invalid property key";
}

export const propertiesSchema = z
  .record(z.string(), propertyValueSchema)
  .superRefine((props, ctx) => {
    const keys = Object.keys(props);
    if (keys.length > LIMITS.maxProperties) {
      ctx.addIssue({ code: "custom", message: `at most ${LIMITS.maxProperties} properties` });
    }
    for (const key of keys) {
      const message = keyIssue(key, props[key]);
      if (message) ctx.addIssue({ code: "custom", path: [key], message });
    }
  });

export type Properties = z.infer<typeof propertiesSchema>;
export type PropertyValue = z.infer<typeof propertyValueSchema>;
