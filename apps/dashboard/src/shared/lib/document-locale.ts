import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import vazirmatnArabic from "@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2?url";
import { dirOf, isLocale, type Locale } from "./i18n";

const STORAGE_KEY = "didban.locale";
// Addendum A2 / ADR 0006: preload only the active script's font.
const PRIMARY_FONT: Record<Locale, string> = { en: interLatin, fa: vazirmatnArabic };

/** Saved choice first, then the browser's languages; English otherwise. */
export function preferredLocale(): Locale {
  const saved = readSaved();
  if (isLocale(saved)) return saved;
  const persian = navigator.languages.some((tag) => tag.toLowerCase().startsWith("fa"));
  return persian ? "fa" : "en";
}

/** Sets `<html lang dir>`, remembers the choice and preloads the script's font. */
export function applyLocale(locale: Locale): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dirOf(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be disabled (private mode, policy); the choice then lasts for this page only.
  }
  preloadFont(PRIMARY_FONT[locale]);
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function preloadFont(href: string): void {
  if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement("link");
  Object.assign(link, { rel: "preload", as: "font", type: "font/woff2", href });
  link.crossOrigin = "anonymous";
  document.head.append(link);
}
