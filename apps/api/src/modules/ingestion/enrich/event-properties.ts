import {
  LIMITS,
  PROPERTY_KEY_PATTERN,
  type Properties,
  RESERVED_PROPERTIES,
} from "@didban/contracts";
import { looksLikePii } from "../../../domain/pii.js";
import type { IngestSettings } from "../ingest-settings.js";

// Spec §6.2 reserved properties + §7 step 6 PII guard + §23.1 site search. Every drop is
// reported as a diagnostics code; the event itself is still accepted.

export type PropertyResult = {
  properties: Properties;
  revenue: number | null;
  currency: string | null;
  drops: string[];
};

type Input = { properties: Properties; query: Record<string, string>; isPage: boolean };

const MAX_SEARCH_TERM_LENGTH = 100;

function takeRevenue(props: Properties, drops: string[]) {
  const revenue = props[RESERVED_PROPERTIES.revenue];
  const currency = props[RESERVED_PROPERTIES.currency];
  delete props[RESERVED_PROPERTIES.revenue];
  delete props[RESERVED_PROPERTIES.currency];
  if (typeof revenue !== "number") return { revenue: null, currency: null };
  if (typeof currency !== "string") {
    drops.push("REVENUE_WITHOUT_CURRENCY");
    return { revenue: null, currency: null };
  }
  return { revenue: Math.round(revenue * 100) / 100, currency };
}

function add(props: Properties, key: string, value: string, drops: string[]): void {
  if (key in props) return; // what the page sent explicitly wins
  if (Object.keys(props).length >= LIMITS.maxProperties || !PROPERTY_KEY_PATTERN.test(key)) {
    drops.push("PROPERTY_DROPPED");
    return;
  }
  props[key] = value;
}

function addQueryValues(
  props: Properties,
  input: Input,
  settings: IngestSettings,
  drops: string[],
) {
  if (input.isPage) {
    const param = settings.siteSearchParams.find((name) => input.query[name]);
    const term = param ? input.query[param] : undefined;
    if (term) add(props, "search_term", term.slice(0, MAX_SEARCH_TERM_LENGTH), drops);
  }
  for (const name of settings.urlRules.keepParams) {
    const value = input.query[name];
    if (value !== undefined && !settings.siteSearchParams.includes(name))
      add(props, name, value, drops);
  }
}

function stripPii(props: Properties, drops: string[]): void {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && looksLikePii(value)) {
      delete props[key];
      drops.push("PII_DROPPED");
    }
  }
}

export function enrichProperties(input: Input, settings: IngestSettings): PropertyResult {
  const properties: Properties = { ...input.properties };
  const drops: string[] = [];
  const { revenue, currency } = takeRevenue(properties, drops);
  addQueryValues(properties, input, settings, drops);
  if (settings.stripPii) stripPii(properties, drops);
  return { properties, revenue, currency, drops };
}
