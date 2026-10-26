import type { Locale } from "./i18n";

// Country and language names from the platform (addendum A4: `Intl.DisplayNames`, no tables).
const cache = new Map<string, Intl.DisplayNames>();

/** `DE` → "Germany", `fa-IR` → "Persian (Iran)"; the code itself when the platform has no name. */
export function displayName(locale: Locale, type: "region" | "language", code: string): string {
  const key = `${locale}:${type}`;
  let names = cache.get(key);
  if (!names) {
    names = new Intl.DisplayNames(locale, { type, fallback: "code" });
    cache.set(key, names);
  }
  try {
    return names.of(code) ?? code;
  } catch {
    return code; // not a well-formed code (RangeError)
  }
}
