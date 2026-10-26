import { type CalendarDate, fromDate, parseDate, toCalendarDate } from "@internationalized/date";
import { rangeDays, readCustomRange, readRange } from "./url-state";

// Spec §3.1: report days are days in the project's reporting time zone, not the browser's.
// Ranges are whole days, so the query (and its cache key) stays the same all day long.

export interface StatsRange {
  /** ISO-8601 UTC instants, `from` inclusive, `to` exclusive (spec §10). */
  from: string;
  to: string;
}

const midnight = (day: CalendarDate, timeZone: string) => day.toDate(timeZone).toISOString();

/** The URL's range (custom `?from=&to=` or a preset ending today) as instants in `timeZone`. */
export function statsRange(
  params: URLSearchParams,
  timeZone: string,
  now = new Date(),
): StatsRange {
  const custom = readCustomRange(params, now);
  const last = custom ? parseDate(custom.to) : toCalendarDate(fromDate(now, timeZone));
  const first = custom
    ? parseDate(custom.from)
    : last.subtract({ days: rangeDays(readRange(params)) - 1 });
  return { from: midnight(first, timeZone), to: midnight(last.add({ days: 1 }), timeZone) };
}
