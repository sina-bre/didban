import { rangeDays, readCustomRange, readRange } from "./url-state";
import { addDays, dayIn, parseDay, startOf } from "./zoned-day";

// Spec §3.1: report days are days in the project's reporting time zone, not the browser's.
// Ranges are whole days, so the query (and its cache key) stays the same all day long.

export interface StatsRange {
  /** ISO-8601 UTC instants, `from` inclusive, `to` exclusive (spec §10). */
  from: string;
  to: string;
}

/** The URL's range (custom `?from=&to=` or a preset ending today) as instants in `timeZone`. */
export function statsRange(
  params: URLSearchParams,
  timeZone: string,
  now = new Date(),
): StatsRange {
  const custom = readCustomRange(params, now);
  const last = custom ? parseDay(custom.to) : dayIn(now, timeZone);
  const first = custom ? parseDay(custom.from) : addDays(last, 1 - rangeDays(readRange(params)));
  const midnight = (day: number) => startOf(day, timeZone).toISOString();
  return { from: midnight(first), to: midnight(addDays(last, 1)) };
}
