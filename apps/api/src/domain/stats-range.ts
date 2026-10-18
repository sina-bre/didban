import type { StatsCompare, StatsInterval } from "@didban/contracts";

// Spec §4 + §10: interval choice, bucket cap and the comparison range. Pure: no SQL, no HTTP.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Rough bucket length, only to bound the number of buckets a request may ask for. */
const APPROX_MS: Record<StatsInterval, number> = {
  hour: HOUR,
  day: DAY,
  week: 7 * DAY,
  month: 28 * DAY,
};
export const MAX_BUCKETS = 1000;

export type Range = { from: Date; to: Date };

/** `auto`: ≤ 2 days → hour, ≤ 92 days → day, ≤ 183 days → week, else month. */
export function chooseInterval(requested: StatsInterval | "auto", range: Range): StatsInterval {
  if (requested !== "auto") return requested;
  const span = range.to.getTime() - range.from.getTime();
  if (span <= 2 * DAY) return "hour";
  if (span <= 92 * DAY) return "day";
  if (span <= 183 * DAY) return "week";
  return "month";
}

/** `false` when the interval would produce more than MAX_BUCKETS buckets (the API answers 400). */
export function bucketsFit(interval: StatsInterval, range: Range): boolean {
  return (range.to.getTime() - range.from.getTime()) / APPROX_MS[interval] <= MAX_BUCKETS;
}

/**
 * `previous_period`: the range of identical length right before `from`. `previous_year`: the same
 * instants one calendar year earlier (UTC calendar; Feb 29 rolls to Mar 1).
 */
export function previousRange(compare: StatsCompare, range: Range): Range | null {
  if (compare === "none") return null;
  if (compare === "previous_period") {
    const span = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - span), to: range.from };
  }
  const yearEarlier = (date: Date) => {
    const shifted = new Date(date);
    shifted.setUTCFullYear(shifted.getUTCFullYear() - 1);
    return shifted;
  };
  return { from: yearEarlier(range.from), to: yearEarlier(range.to) };
}
