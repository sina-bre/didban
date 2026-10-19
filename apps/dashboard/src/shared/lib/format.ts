import type { Locale } from "./i18n";

// The one place numbers and dates are formatted (ADR 0005). Formatters are cached per locale.
// `fa` uses the locale's own calendar (Persian) and digits.
const dateRanges = new Map<Locale, Intl.DateTimeFormat>();

export function formatDateRange(locale: Locale, from: Date, to: Date): string {
  let format = dateRanges.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    dateRanges.set(locale, format);
  }
  return format.formatRange(from, to);
}
