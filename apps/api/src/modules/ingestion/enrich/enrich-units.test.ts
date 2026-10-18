import { CHANNELS, DEVICE_TYPES } from "@didban/contracts";
import { describe, expect, it } from "vitest";
import { type SettingsRow, toIngestSettings } from "../ingest-settings.js";
import { classifyChannel } from "./channel.js";
import { enrichProperties } from "./event-properties.js";
import { type GeoLookup, toGeo } from "./geo-lookup.js";
import { readReferrer } from "./referrer.js";
import { browserTraits } from "./request-traits.js";
import { isBotUserAgent, parseUserAgent } from "./user-agent.js";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

const settingsRow = (overrides: Partial<SettingsRow> = {}): SettingsRow => ({
  identityMode: "cookieless",
  allowIdentify: false,
  sessionTimeoutMinutes: 30,
  piiGuard: "strip",
  urlParamAllowlist: [],
  trailingSlashPolicy: "strip",
  hashRouting: false,
  storeCity: false,
  siteSearchParams: [],
  excludedCidrs: [],
  trackLocalhost: false,
  allowedOrigins: ["https://heliumpark.example"],
  routePatterns: [],
  ...overrides,
});

describe("referrer → source (spec §7 step 6)", () => {
  it("keeps only the host and names known sources, subdomains and ccTLDs included", () => {
    expect(readReferrer("https://www.google.co.uk/search?q=secret", [])).toEqual({
      host: "google.co.uk",
      source: "Google",
      type: "search",
    });
    expect(readReferrer("https://old.reddit.com/r/x", [])?.source).toBe("Reddit");
    expect(readReferrer("https://blog.example.org/p", [])).toEqual({
      host: "blog.example.org",
      source: null,
      type: null,
    });
    expect(readReferrer("https://google.evil.example.com/", [])?.source).toBeNull();
  });

  it("treats self-referrals, garbage and non-http as no referrer", () => {
    expect(readReferrer("https://www.heliumpark.example/a", ["heliumpark.example"])).toBeNull();
    expect(readReferrer("android-app://com.x", [])).toBeNull();
    expect(readReferrer("nope", [])).toBeNull();
    expect(readReferrer(undefined, [])).toBeNull();
  });
});

describe("channel grouping (spec §4)", () => {
  const channel = (utmMedium: string | null, referrerType: "search" | null | undefined) =>
    classifyChannel({ utmMedium, hasUtm: utmMedium !== null, referrerType });

  it("follows the spec table", () => {
    expect(channel(null, undefined)).toBe(CHANNELS.direct);
    expect(channel(null, "search")).toBe(CHANNELS.organicSearch);
    expect(channel("organic", undefined)).toBe(CHANNELS.organicSearch);
    expect(channel("CPC", "search")).toBe(CHANNELS.paidSearch);
    expect(channel("social", undefined)).toBe(CHANNELS.social);
    expect(channel("email", undefined)).toBe(CHANNELS.email);
    expect(channel(null, null)).toBe(CHANNELS.referral);
    expect(channel("banner", undefined)).toBe(CHANNELS.referral);
  });
});

describe("user agent and bots (spec §7 step 6)", () => {
  it("normalizes browser, major version, OS and device type", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({
      browser: "Chrome",
      browserMajor: 141,
      os: "Windows",
      deviceType: DEVICE_TYPES.desktop,
    });
    expect(parseUserAgent(IPHONE).deviceType).toBe(DEVICE_TYPES.mobile);
    const chromeOs = CHROME_WIN.replace(
      "Windows NT 10.0; Win64; x64",
      "X11; CrOS x86_64 14541.0.0",
    );
    expect(parseUserAgent(chromeOs).deviceType).toBe(DEVICE_TYPES.desktop);
  });

  it("flags crawlers, headless browsers and a missing UA", () => {
    expect(isBotUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent(CHROME_WIN.replace("Chrome/", "HeadlessChrome/"))).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent(CHROME_WIN)).toBe(false);
  });
});

describe("geo (spec §7 step 6)", () => {
  const response = {
    country: { iso_code: "IR", geoname_id: 1, names: { en: "Iran" } },
    subdivisions: [{ iso_code: "23", geoname_id: 2, names: { en: "Tehran" } }],
    city: { geoname_id: 3, names: { en: "Tehran" } },
  };

  it("maps country, ISO 3166-2 region, and city only when the project opts in", () => {
    expect(toGeo(response, false)).toEqual({ country: "IR", region: "IR-23", city: null });
    expect(toGeo(response, true).city).toBe("Tehran");
    expect(toGeo(null, true)).toEqual({ country: null, region: null, city: null });
  });
});

describe("request traits", () => {
  const geo = {
    lookup: () => ({ country: "DE", region: null, city: null }),
  } as unknown as GeoLookup;
  const settings = toIngestSettings(
    settingsRow({ excludedCidrs: ["203.0.113.0/24", "2001:db8::/32"] }),
  );
  const traits = (ip: string, userAgent = CHROME_WIN) =>
    browserTraits(
      {
        client: { ip, userAgent },
        settings,
        context: { locale: "fa-ir", screen: { w: 390, h: 844 } },
      },
      geo,
    );

  it("drops internal traffic by CIDR, IPv4-mapped and IPv6 included", () => {
    expect(traits("203.0.113.9").drop).toBe("INTERNAL_TRAFFIC");
    expect(traits("::ffff:203.0.113.9").drop).toBe("INTERNAL_TRAFFIC");
    expect(traits("2001:db8::1").drop).toBe("INTERNAL_TRAFFIC");
    expect(traits("198.51.100.1").drop).toBeNull();
  });

  it("derives language, screen class, device and geo for real visitors", () => {
    const result = traits("198.51.100.1");
    expect(result).toMatchObject({
      language: "fa-IR",
      screenClass: 1,
      country: "DE",
      browser: "Chrome",
    });
    expect(traits("198.51.100.1", "curl/8.0").drop).toBe("BOT_FILTERED");
  });
});

describe("properties: revenue, query values, site search, PII", () => {
  const settings = toIngestSettings(
    settingsRow({ urlParamAllowlist: ["plan", "bad-name"], siteSearchParams: ["q"] }),
  );

  it("moves $revenue/$currency to columns; revenue without currency is dropped", () => {
    const ok = enrichProperties(
      { properties: { $revenue: 19.999, $currency: "EUR", seats: 3 }, query: {}, isPage: false },
      settings,
    );
    expect(ok).toMatchObject({ revenue: 20, currency: "EUR", properties: { seats: 3 }, drops: [] });
    const lone = enrichProperties(
      { properties: { $revenue: 5 }, query: {}, isPage: false },
      settings,
    );
    expect(lone).toMatchObject({
      revenue: null,
      currency: null,
      properties: {},
      drops: ["REVENUE_WITHOUT_CURRENCY"],
    });
  });

  it("adds allowlisted query values and the search term; unsafe keys are dropped", () => {
    const query = { plan: "pro", "bad-name": "x", q: "running shoes" };
    const result = enrichProperties({ properties: {}, query, isPage: true }, settings);
    expect(result.properties).toEqual({ plan: "pro", search_term: "running shoes" });
    expect(result.drops).toEqual(["PROPERTY_DROPPED"]);
  });

  it("strips email-like and card-like values when the guard is on", () => {
    const properties = { email: "a@b.io", card: "4111 1111 1111 1111", plan: "pro" };
    const result = enrichProperties(
      { properties, query: { q: "me@x.org" }, isPage: true },
      settings,
    );
    expect(result.properties).toEqual({ plan: "pro" });
    expect(result.drops).toEqual(["PII_DROPPED", "PII_DROPPED", "PII_DROPPED"]);
    const off = toIngestSettings(settingsRow({ piiGuard: "off" }));
    expect(enrichProperties({ properties, query: {}, isPage: false }, off).properties).toEqual(
      properties,
    );
  });
});
