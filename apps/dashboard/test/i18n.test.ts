import { describe, expect, it } from "vitest";
import en from "../src/messages/en";
import fa from "../src/messages/fa";
import { createT, dirOf, isLocale, loadMessages, type Messages } from "../src/shared/lib/i18n";

describe("t()", () => {
  const t = createT(en, "en");

  it("returns the message for a key", () => {
    expect(t("nav.overview")).toBe("Overview");
  });

  it("picks the plural form with Intl.PluralRules and formats the count", () => {
    expect(t("range.lastDays", { count: 1 })).toBe("Last 1 day");
    expect(t("range.lastDays", { count: 1200 })).toBe("Last 1,200 days");
  });

  it("formats numbers with the locale's digits", () => {
    expect(createT(fa, "fa")("range.lastDays", { count: 30 })).toBe("۳۰ روز گذشته");
  });

  it("leaves unknown placeholders visible instead of printing undefined", () => {
    const messages = { ...en, "notFound.body": "Hello {name}" } as Messages;
    expect(createT(messages, "en")("notFound.body")).toBe("Hello {name}");
  });
});

describe("locales", () => {
  it("maps Persian to rtl and English to ltr", () => {
    expect(dirOf("fa")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });

  it("accepts only shipped locales", () => {
    expect(isLocale("fa")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("fa has exactly the keys of en (no stale extras)", () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  it("loads catalogs lazily by locale", async () => {
    expect((await loadMessages("fa"))["nav.more"]).toBe("بیشتر");
  });
});
