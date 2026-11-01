// Calendar days in an IANA time zone with the platform's Intl (no date library on the report path:
// @internationalized/date cost 30 KB gz and ~130 ms of start-up on a phone, Lighthouse Stage 5f).

/** A calendar day as a UTC-midnight timestamp: plain day arithmetic, no zone involved. */
export type Day = number;

const DAY_MS = 86_400_000;
const parts = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: number, timeZone: string): number {
  let format = parts.get(timeZone);
  if (!format) {
    const numeric = "numeric";
    format = new Intl.DateTimeFormat("en-US", {
      ...{ year: numeric, month: numeric, day: numeric, hour: numeric, minute: numeric },
      ...{ second: numeric, hourCycle: "h23", timeZone },
    });
    parts.set(timeZone, format);
  }
  const p = Object.fromEntries(format.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(
    p.year ?? 0,
    (p.month ?? 1) - 1,
    p.day ?? 1,
    p.hour ?? 0,
    p.minute ?? 0,
    p.second ?? 0,
  );
}

/** The day `instant` falls on in `timeZone`. */
export function dayIn(instant: Date, timeZone: string): Day {
  const local = wallClock(instant.getTime(), timeZone);
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
}

/** `YYYY-MM-DD` as a Day. */
export const parseDay = (iso: string): Day => Date.parse(`${iso}T00:00:00Z`);

export const addDays = (day: Day, days: number): Day => day + days * DAY_MS;

/**
 * The instant the day starts in `timeZone`. Where midnight does not exist (a DST jump at 00:00),
 * the first instant after the gap, as `Temporal`'s "compatible" choice.
 */
export function startOf(day: Day, timeZone: string): Date {
  let instant = day - (wallClock(day, timeZone) - day);
  instant = day - (wallClock(instant, timeZone) - instant); // second pass settles a DST edge
  const wall = wallClock(instant, timeZone);
  return new Date(wall < day ? instant + (day - wall) : instant); // in a gap: its end
}
