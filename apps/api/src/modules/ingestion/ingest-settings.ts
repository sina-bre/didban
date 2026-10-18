import { BlockList, isIP } from "node:net";
import { parseRouteTemplate, type RouteTemplate } from "../../domain/route-template.js";
import type { UrlRules } from "../../domain/sanitize-url.js";

// Project + environment settings that enrichment and identity need, loaded with the write key
// and cached with it (ADR 0025: changes take effect within 60 s per process).

export type SettingsRow = {
  identityMode: "cookieless" | "persistent";
  allowIdentify: boolean;
  sessionTimeoutMinutes: number;
  piiGuard: "strip" | "off";
  urlParamAllowlist: string[];
  trailingSlashPolicy: "strip" | "keep";
  hashRouting: boolean;
  storeCity: boolean;
  siteSearchParams: string[];
  excludedCidrs: string[];
  trackLocalhost: boolean;
  allowedOrigins: string[];
  routePatterns: string[];
};

export type IngestSettings = Pick<
  SettingsRow,
  "identityMode" | "allowIdentify" | "sessionTimeoutMinutes" | "storeCity" | "siteSearchParams"
> & {
  stripPii: boolean;
  trackLocalhost: boolean;
  urlRules: UrlRules;
  excluded: BlockList;
  /** Hosts of the allowed origins: referrers from these are self-referrals. */
  ownHosts: string[];
  routes: RouteTemplate[];
};

/** "::ffff:203.0.113.7" → "203.0.113.7", so IPv4 rules match IPv4-mapped socket addresses. */
export function plainIp(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped?.[1] ?? ip;
}

function blockList(cidrs: readonly string[]): BlockList {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address = "", prefix] = cidr.split("/");
    const type = isIP(address) === 6 ? "ipv6" : "ipv4";
    list.addSubnet(address, Number(prefix), type);
  }
  return list;
}

export function toIngestSettings(row: SettingsRow): IngestSettings {
  return {
    identityMode: row.identityMode,
    allowIdentify: row.allowIdentify,
    sessionTimeoutMinutes: row.sessionTimeoutMinutes,
    storeCity: row.storeCity,
    siteSearchParams: row.siteSearchParams,
    stripPii: row.piiGuard === "strip",
    trackLocalhost: row.trackLocalhost,
    urlRules: {
      hashRouting: row.hashRouting,
      trailingSlash: row.trailingSlashPolicy,
      keepParams: [...row.urlParamAllowlist, ...row.siteSearchParams],
    },
    excluded: blockList(row.excludedCidrs),
    ownHosts: row.allowedOrigins.map((origin) => new URL(origin).hostname),
    // Patterns were validated on save; an unparseable one is skipped rather than failing ingest.
    routes: row.routePatterns.flatMap((pattern) => parseRouteTemplate(pattern) ?? []),
  };
}
