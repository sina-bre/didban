import { isIP } from "node:net";
import { type BatchContext, SCREEN_CLASSES } from "@didban/contracts";
import { type IngestSettings, plainIp } from "../ingest-settings.js";
import type { Geo, GeoLookup } from "./geo-lookup.js";
import { type Device, isBotUserAgent, parseUserAgent } from "./user-agent.js";

// What one request says about the visitor, computed once per batch. Server-key requests come from
// the operator's server, so IP, UA and geo are not the visitor's: they stay null (spec §6.2).

export type DropReason = "BOT_FILTERED" | "INTERNAL_TRAFFIC";
export type RequestTraits = Device &
  Geo & { drop: DropReason | null; language: string | null; screenClass: number | null };
export type Client = { ip: string; userAgent: string | undefined };

const EMPTY = {
  browser: null,
  browserMajor: null,
  os: null,
  deviceType: null,
  country: null,
  region: null,
  city: null,
} as const;

function language(locale: string | undefined): string | null {
  if (!locale) return null;
  try {
    return Intl.getCanonicalLocales(locale)[0]?.slice(0, 35) ?? null;
  } catch {
    return null;
  }
}

function screenClass(context: BatchContext | undefined): number | null {
  const width = context?.screen?.w;
  if (!width) return null;
  return SCREEN_CLASSES.find((entry) => width < entry.maxWidth)?.code ?? null;
}

function dropReason(client: Client, ip: string, settings: IngestSettings): DropReason | null {
  if (isBotUserAgent(client.userAgent)) return "BOT_FILTERED";
  const type = isIP(ip) === 6 ? "ipv6" : "ipv4";
  return isIP(ip) && settings.excluded.check(ip, type) ? "INTERNAL_TRAFFIC" : null;
}

export type TraitsInput = { client: Client; context?: BatchContext; settings: IngestSettings };

export function browserTraits(input: TraitsInput, geo: GeoLookup): RequestTraits {
  const { client, settings } = input;
  const ip = plainIp(client.ip);
  const drop = dropReason(client, ip, settings);
  const device = client.userAgent && !drop ? parseUserAgent(client.userAgent) : EMPTY;
  return {
    ...EMPTY,
    ...device,
    ...(drop ? {} : geo.lookup(ip, settings.storeCity)),
    drop,
    language: language(input.context?.locale),
    screenClass: screenClass(input.context),
  };
}

export function serverTraits(): RequestTraits {
  return { ...EMPTY, drop: null, language: null, screenClass: null };
}
