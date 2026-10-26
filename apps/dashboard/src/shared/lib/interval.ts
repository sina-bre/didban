import type { StatsInterval } from "@didban/contracts";

// Spec §13.4: the interval selector offers only choices that make sense for the range. `auto`
// (the default, not written to the URL) lets the API pick (≤ 2 days hour, ≤ 92 day, ...).
export type IntervalChoice = StatsInterval | "auto";

/** Smallest and largest range (in days) each interval is offered for. */
const SPANS: Record<StatsInterval, { min: number; max: number }> = {
  hour: { min: 1, max: 7 },
  day: { min: 2, max: 366 },
  week: { min: 14, max: 366 },
  month: { min: 60, max: 366 },
};

const ORDER: StatsInterval[] = ["hour", "day", "week", "month"];

/** `auto` plus every interval that fits a range of `days` days. */
export function intervalChoices(days: number): IntervalChoice[] {
  return ["auto", ...ORDER.filter((i) => days >= SPANS[i].min && days <= SPANS[i].max)];
}

/** `?interval=` when it is one of the choices for the range, else `auto`. */
export function readInterval(params: URLSearchParams, days: number): IntervalChoice {
  const value = params.get("interval") as IntervalChoice | null;
  return value && intervalChoices(days).includes(value) ? value : "auto";
}

/** Whole days between two ISO instants (a zone's DST day still counts as one). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
