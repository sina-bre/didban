import { addDays, dayIn, startOf } from "./zoned-day.js";

// Spec §10 stats queries take `from`/`to`, or a relative `range` the API resolves in the project's
// reporting zone: whole days ending today. A client can then ask before it knows the zone
// (Overview LCP, ADR 0046).
export const RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const DAYS: Record<RangePreset, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

export const rangeDays = (preset: RangePreset): number => DAYS[preset];

export const isRangePreset = (value: unknown): value is RangePreset =>
  RANGE_PRESETS.includes(value as RangePreset);

/** From midnight `days - 1` days ago to the next midnight, both in `timeZone`. */
export function presetRange(
  preset: RangePreset,
  timeZone: string,
  now = new Date(),
): { from: Date; to: Date } {
  const today = dayIn(now, timeZone);
  return {
    from: startOf(addDays(today, 1 - DAYS[preset]), timeZone),
    to: startOf(addDays(today, 1), timeZone),
  };
}

/**
 * A raw query string with `range` as the same with `from`/`to` (ISO UTC) in `timeZone`; without
 * `range`, unchanged. `null` = an unknown preset, or `range` together with `from`/`to`.
 */
export function resolveRelativeRange(
  raw: Record<string, unknown>,
  timeZone: string,
  now = new Date(),
): Record<string, unknown> | null {
  if (raw.range === undefined) return raw;
  const { range, ...rest } = raw;
  if (!isRangePreset(range) || rest.from !== undefined || rest.to !== undefined) return null;
  const { from, to } = presetRange(range, timeZone, now);
  return { ...rest, from: from.toISOString(), to: to.toISOString() };
}
