// Spec §13.4: the date range lives in the URL, so back/forward and shared links keep it.
// `?range=` is a preset; `?from=&to=` (local ISO days) is a custom range and wins when valid.
export const RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** 30 days, not 90: 90-day top pages exceed 10 s at 10 M events (docs/database.md, ADR 0037). */
export const DEFAULT_RANGE: RangePreset = "30d";

/** Same cap as the API (`MAX_RANGE_DAYS` in @didban/contracts). */
export const MAX_CUSTOM_DAYS = 366;

const DAYS: Record<RangePreset, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export interface CustomRange {
  from: string;
  to: string;
}

export function readRange(params: URLSearchParams): RangePreset {
  const value = params.get("range");
  return RANGE_PRESETS.includes(value as RangePreset) ? (value as RangePreset) : DEFAULT_RANGE;
}

export const rangeDays = (preset: RangePreset): number => DAYS[preset];

/** Local calendar day as `YYYY-MM-DD`. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of an ISO day, or `null` for anything that is not a real date. */
function parseDay(value: string | null): Date | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return isoDay(date) === value ? date : null;
}

/** `?from=&to=` when both are real days, in order, not in the future and ≤ 366 days apart. */
export function readCustomRange(params: URLSearchParams, now = new Date()): CustomRange | null {
  const from = parseDay(params.get("from"));
  const to = parseDay(params.get("to"));
  if (!from || !to || from > to || isoDay(to) > isoDay(now)) return null;
  if (Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1 > MAX_CUSTOM_DAYS) return null;
  return { from: isoDay(from), to: isoDay(to) };
}

/** Whole local days ending today: `from` is midnight `days - 1` days ago, `to` is now. */
export function rangeBounds(preset: RangePreset, now = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (DAYS[preset] - 1));
  return { from, to: now };
}

/** A custom range covers its first day from midnight to the end of its last day. */
export function customBounds(range: CustomRange): { from: Date; to: Date } {
  const from = parseDay(range.from) as Date;
  const to = parseDay(range.to) as Date;
  to.setDate(to.getDate() + 1);
  return { from, to: new Date(to.getTime() - 1) };
}
