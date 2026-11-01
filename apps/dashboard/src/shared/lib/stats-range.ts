import { addDays, parseDay, type RangePreset, startOf } from "@didban/contracts";
import { readCustomRange, readRange } from "./url-state";

// Spec §3.1: report days are days in the project's reporting time zone, not the browser's.
// A preset goes to the API as `range` and the API resolves it in that zone (ADR 0046), so the
// first reports need not wait for the project. Custom ranges are resolved here, as whole days.

/** ISO-8601 UTC instants, `from` inclusive, `to` exclusive (spec §10), or a preset. */
export type StatsRange = { from: string; to: string } | { range: RangePreset };

/** The URL's range: a custom `?from=&to=` as instants in `timeZone`, else its preset. */
export function statsRange(
  params: URLSearchParams,
  timeZone: string,
  now = new Date(),
): StatsRange {
  const custom = readCustomRange(params, now);
  if (!custom) return { range: readRange(params) };
  const midnight = (day: number) => startOf(day, timeZone).toISOString();
  return { from: midnight(parseDay(custom.from)), to: midnight(addDays(parseDay(custom.to), 1)) };
}
