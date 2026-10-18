# 0026 — Ingestion enrichment (Stage 3b)

- Status: Accepted
- Date: 2026-10-18

## Context
Spec §7 step 6, §4 (channels), §6.2 (server keys, revenue), §23.1 (site search, identify).
ADR 0001 left the UA parser open (bowser vs my-ua-parser). The spec does not fix where
allowlisted query values go, how channels are coded, or what counts as "localhost".

## Decision
- **Libraries:** `bowser` 2.14.1 (MIT) for UA parsing, `isbot` 5.2.2 (Unlicense) for bots,
  `maxmind` 5.0.7 (MIT) for geo. A test on 14 real UAs (desktop, iOS/Android phone + tablet,
  TV, Samsung, Yandex, Opera, Chrome OS) gave the same results for bowser and my-ua-parser.
  bowser won because it is maintained (2026 release; my-ua-parser's last release is 2024).
- **Order per batch:** request traits once (bot → internal CIDR → UA → geo), then per event:
  URL → localhost check → properties → UTM → referrer → channel → route. Bot, internal and
  localhost events are dropped silently and counted in `ingestion_diagnostics`
  (`BOT_FILTERED`, `INTERNAL_TRAFFIC`, `LOCALHOST_EXCLUDED`). Field drops are counted the same
  way (`PII_DROPPED`, `PROPERTY_DROPPED`, `REVENUE_WITHOUT_CURRENCY`). A missing User-Agent is a bot.
- **Client IP:** Fastify's `trustProxy` (from `TRUST_PROXY`: hop count or CIDR list) walks
  `X-Forwarded-For` from the right. With nothing trusted, the socket address is used. IPv4-mapped
  IPv6 addresses are unwrapped before CIDR checks (`node:net` `BlockList`).
- **Server keys:** no UA, IP, geo, bot or localhost handling. Device and geo stay null.
- **Geo:** optional `GEOIP_DB_PATH` (GeoLite2 Country or City). If it is unset, geo is null.
  A configured file that cannot be opened stops startup. Region = ISO 3166-2 (`IR-23`). City
  only with `projects.store_city`. The datacenter-ASN deny list (optional in the spec) is not built.
- **URL:** host lowercased by the URL parser. Hash kept only with `projects.hash_routing`.
  Query reduced to `utm_*`, `ref`, `source`, the allowlist and the site-search params. Values
  are capped at 255 chars, the pathname at 1024. `ref`/`source` stand in for a missing `utm_source`.
  Allowlisted values become properties when the key is a valid property key and there is room
  (page-sent keys win). The site-search value becomes `search_term` (≤ 100 chars).
- **Referrer:** host only (events have no referrer-path column), `www.` removed. Mapped by
  `apps/api/data/sources.json` (suffix match, `name.*` for ccTLD families). Self-referrals
  (the page's host or an allowed-origin host) count as no referrer.
- **Channels:** codes in `@didban/contracts` `CHANNELS` (0 direct … 5 referral). `utm_medium`
  wins, then the source type, then Referral for unknown referrers or UTM-only visits.
  Rules are in `data/channels.json`.
- **Routes:** `:param` = one segment, trailing `*` = the rest. Matching splits on `/` and
  compares segments, so there is no regex at all. Literals are limited to `[A-Za-z0-9._~%@#-]`.
  Table `route_templates`: position 1–200 + PK caps the count at 200. The templates are loaded
  with the write key.
- **PII guard (`strip`):** email-like or Luhn-valid 13–19-digit values are dropped from
  properties, kept query values, UTM values and `userId`.
- **Revenue:** `$revenue` without `$currency` is dropped. Otherwise it is rounded to 2
  decimals and moved to columns.

## Consequences
- Settings changes (templates, CIDRs, PII guard) take effect within 60 s per process, like keys.
- The enriched batch is not stored until Stage 3c, and valid batches still get 503.
- Identity (3c) gets the raw IP and UA in memory only, for the daily-salted hash.
- Revisit the UA parser if the accuracy of new browsers drops. Its output is the only coupling.
