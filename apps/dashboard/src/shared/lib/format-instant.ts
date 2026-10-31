import type { Locale } from "./i18n";

// Management timestamps (key created, last used, audit entries) in the browser's own zone:
// they are moments, not report days, so the project's reporting zone does not apply.
const formats = new Map<string, Intl.DateTimeFormat>();

/** "Oct 3, 2026, 14:05" / the Persian calendar and digits for `fa`; "—" for `null`. */
export function formatInstant(locale: Locale, iso: string | null, withTime = true): string {
  if (iso === null) return "—";
  const key = `${locale}:${withTime}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" } : {}),
    });
    formats.set(key, format);
  }
  return format.format(new Date(iso));
}
