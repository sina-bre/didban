// Spec §13.4: the date range lives in the URL (`?range=`), so back/forward and shared links keep it.
export const RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** 30 days, not 90: 90-day top pages exceed 10 s at 10 M events (docs/database.md, ADR 0037). */
export const DEFAULT_RANGE: RangePreset = "30d";

const DAYS: Record<RangePreset, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

export function readRange(params: URLSearchParams): RangePreset {
  const value = params.get("range");
  return RANGE_PRESETS.includes(value as RangePreset) ? (value as RangePreset) : DEFAULT_RANGE;
}

export const rangeDays = (preset: RangePreset): number => DAYS[preset];

/** Whole local days ending today: `from` is midnight `days - 1` days ago, `to` is now. */
export function rangeBounds(preset: RangePreset, now = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (DAYS[preset] - 1));
  return { from, to: now };
}
