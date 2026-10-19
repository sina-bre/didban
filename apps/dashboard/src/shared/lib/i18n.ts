import type en from "../../messages/en";

// ADR 0005: typed message objects + Intl, no i18n library. `en` is the source of truth.
export const LOCALES = ["en", "fa"] as const;
export type Locale = (typeof LOCALES)[number];
export type Dir = "ltr" | "rtl";

type Plural = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
type Catalog = typeof en;
export type MessageKey = keyof Catalog;
/** A locale's catalog: every key of `en`, plural entries keep their shape. */
export type Messages = { [K in MessageKey]: Catalog[K] extends string ? string : Plural };
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

const RTL_LANGUAGES = new Set(["fa", "ar", "he"]);

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);
export const dirOf = (locale: Locale): Dir => (RTL_LANGUAGES.has(locale) ? "rtl" : "ltr");

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import("../../messages/en"),
  fa: () => import("../../messages/fa"),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}

/** `{name}` interpolation (numbers formatted for the locale); plurals pick by `params.count`. */
export function createT(messages: Messages, locale: Locale): Translate {
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  return (key, params = {}) => {
    const entry = messages[key];
    const template =
      typeof entry === "string"
        ? entry
        : (entry[plurals.select(Number(params.count))] ?? entry.other);
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return typeof value === "number" ? numbers.format(value) : value;
    });
  };
}
