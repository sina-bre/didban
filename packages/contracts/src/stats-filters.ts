import { PROPERTY_KEY_PATTERN } from "./limits.js";

// Spec §10: `filter=field:op:value`, repeated. Fields come from this allowlist (the API maps each
// to a column; user input never becomes an identifier). `prop.<key>` filters a custom property.
export const FILTER_FIELDS = [
  "hostname",
  "pathname",
  "route",
  "name",
  "channel",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "country",
  "region",
  "city",
  "browser",
  "os",
  "device_type",
  "screen",
  "language",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number] | `prop.${string}`;

export const FILTER_OPS = ["eq", "neq", "contains", "in"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const MAX_FILTERS = 10;
export const MAX_IN_VALUES = 20;
export const MAX_FILTER_VALUE_LENGTH = 255;

/** `in` values are separated by `|`. Every filter has at least one non-empty value. */
export type StatsFilter = { field: FilterField; op: FilterOp; values: string[] };

const isField = (field: string): field is FilterField =>
  (FILTER_FIELDS as readonly string[]).includes(field) ||
  (field.startsWith("prop.") && PROPERTY_KEY_PATTERN.test(field.slice(5)));

/** Parses one `field:op:value`; `null` when anything is off (the API answers 400). */
export function parseFilter(raw: string): StatsFilter | null {
  const first = raw.indexOf(":");
  const second = raw.indexOf(":", first + 1);
  if (first < 1 || second < 0) return null;
  const field = raw.slice(0, first);
  const op = raw.slice(first + 1, second) as FilterOp;
  const value = raw.slice(second + 1);
  if (!isField(field) || !FILTER_OPS.includes(op)) return null;
  const values = op === "in" ? value.split("|") : [value];
  const valid = values.every((v) => v.length > 0 && v.length <= MAX_FILTER_VALUE_LENGTH);
  if (!valid || values.length > MAX_IN_VALUES) return null;
  return { field, op, values };
}

export const formatFilter = (filter: StatsFilter): string =>
  `${filter.field}:${filter.op}:${filter.values.join("|")}`;
