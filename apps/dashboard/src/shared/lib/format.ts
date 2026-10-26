import type { Locale } from "./i18n";

// The one place numbers and dates are formatted (ADR 0005). Formatters are cached per locale and
// kind. `fa` uses the locale's own calendar (Persian) and digits.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  let format = cache.get(key);
  if (!format) {
    format = make();
    cache.set(key, format);
  }
  return format as T;
}

export function formatDateRange(locale: Locale, from: Date, to: Date): string {
  const options = { day: "numeric", month: "short", year: "numeric" } as const;
  return cached(`${locale}:range`, () => new Intl.DateTimeFormat(locale, options)).formatRange(
    from,
    to,
  );
}

/** Day and month, for chart axes and table rows ("Oct 3" / "۱۱ مهر"). */
export function formatDay(locale: Locale, date: Date): string {
  const options = { day: "numeric", month: "short" } as const;
  return cached(`${locale}:day`, () => new Intl.DateTimeFormat(locale, options)).format(date);
}

/** Counts. `compact` gives "12.4K" (mobile, design system §4). */
export function formatNumber(locale: Locale, value: number, compact = false): string {
  const key = `${locale}:${compact ? "compact" : "number"}`;
  return cached(key, () =>
    compact
      ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })
      : new Intl.NumberFormat(locale),
  ).format(value);
}

/** Ratio as a percentage with one decimal; `signed` adds + / − (deltas). */
export function formatPercent(locale: Locale, ratio: number, signed = false): string {
  const key = `${locale}:${signed ? "delta" : "percent"}`;
  return cached(
    key,
    () =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
        signDisplay: signed ? "exceptZero" : "auto",
      }),
  ).format(ratio);
}

/** A time-series bucket in the project's zone: "14:00" for hours, "Oct 3" otherwise. */
export function formatBucket(
  locale: Locale,
  date: Date,
  hourly: boolean,
  timeZone: string,
): string {
  const options = hourly
    ? ({ hour: "numeric", minute: "2-digit", timeZone } as const)
    : ({ day: "numeric", month: "short", timeZone } as const);
  const key = `${locale}:${hourly ? "hour" : "day"}:${timeZone}`;
  return cached(key, () => new Intl.DateTimeFormat(locale, options)).format(date);
}

/** Seconds as "1 min, 23 sec" (narrow units in the locale's words and digits). */
export function formatDuration(locale: Locale, seconds: number): string {
  const unit = (name: "minute" | "second") =>
    cached(
      `${locale}:${name}`,
      () => new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }),
    );
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = unit("second").format(whole % 60);
  return minutes > 0 ? `${unit("minute").format(minutes)} ${rest}` : rest;
}
