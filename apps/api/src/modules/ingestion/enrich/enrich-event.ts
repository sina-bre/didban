import type { Channel, Properties } from "@didban/contracts";
import { looksLikePii } from "../../../domain/pii.js";
import { matchRoute } from "../../../domain/route-template.js";
import { sanitizeUrl } from "../../../domain/sanitize-url.js";
import type { IngestSettings } from "../ingest-settings.js";
import type { ValidEvent } from "../validate-batch.js";
import { classifyChannel } from "./channel.js";
import { enrichProperties } from "./event-properties.js";
import { readReferrer } from "./referrer.js";

// Spec §7 step 6 for one event: URL, referrer → source/channel, UTM, route, properties.

export type Utm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
};
export type PageFields = {
  hostname: string;
  pathname: string;
  route: string;
  referrerHost: string | null;
  referrerSource: string | null;
  channel: Channel;
  utm: Utm;
  userId: string | null;
  properties: Properties;
  revenue: number | null;
  currency: string | null;
};
export type EventResult = { fields: PageFields; drops: string[] } | { localhost: true };

const LOCALHOST = /^(localhost|.+\.localhost|127\.\d+\.\d+\.\d+|\[::1\])$/;

function utmOf(query: Record<string, string>, drops: string[], stripPii: boolean): Utm {
  const value = (raw: string | undefined) => {
    if (raw === undefined) return null;
    if (stripPii && looksLikePii(raw)) {
      drops.push("PII_DROPPED");
      return null;
    }
    return raw;
  };
  return {
    // `ref` and `source` are common stand-ins for utm_source (spec §7 keeps them for this).
    source: value(query.utm_source ?? query.ref ?? query.source),
    medium: value(query.utm_medium),
    campaign: value(query.utm_campaign),
    term: value(query.utm_term),
    content: value(query.utm_content),
  };
}

/** Spec §23.1: identify must not store emails; the PII guard drops such user IDs. */
function cleanUserId(
  userId: string | undefined,
  drops: string[],
  stripPii: boolean,
): string | null {
  if (!userId) return null;
  if (!stripPii || !looksLikePii(userId)) return userId;
  drops.push("PII_DROPPED");
  return null;
}

export function enrichEvent(
  valid: ValidEvent,
  settings: IngestSettings,
  isBrowser: boolean,
): EventResult {
  const { event } = valid;
  const url = sanitizeUrl(event.url, settings.urlRules);
  if (!url) throw new Error("validated event URL did not parse");
  if (isBrowser && !settings.trackLocalhost && LOCALHOST.test(url.hostname))
    return { localhost: true };
  const props = enrichProperties(
    { properties: event.properties, query: url.query, isPage: event.type === "page" },
    settings,
  );
  const drops = props.drops;
  const utm = utmOf(url.query, drops, settings.stripPii);
  const referrer = readReferrer(event.referrer, [url.hostname, ...settings.ownHosts]);
  const hasUtm = Object.values(utm).some((value) => value !== null);
  const userId = cleanUserId(event.userId, drops, settings.stripPii);
  const channel = classifyChannel({
    utmMedium: utm.medium,
    hasUtm,
    referrerType: referrer ? referrer.type : undefined,
  });
  const fields: PageFields = {
    hostname: url.hostname,
    pathname: url.pathname,
    route: matchRoute(settings.routes, url.pathname),
    referrerHost: referrer?.host ?? null,
    referrerSource: referrer?.source ?? null,
    channel,
    utm,
    userId,
    properties: props.properties,
    revenue: props.revenue,
    currency: props.currency,
  };
  return { fields, drops };
}
