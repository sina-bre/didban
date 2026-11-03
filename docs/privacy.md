# Privacy

What the SDK sends, what the server stores, and how long. Controls, not compliance: see
[security](security.md#not-claimed) for what the operator remains responsible for.

## Defaults (spec §12)
- **Cookieless.** No cookies, no local storage, no stable ID from the browser. The server derives
  `visitor_id` = 16 bytes of SHA-256(daily salt, project, IP, normalized user agent). The salt is
  random per UTC day and deleted after at most 48 h, so yesterday's IDs cannot be recomputed and a
  person cannot be followed across days (ADR 0007). Backups exclude salts.
- **Persistent mode is opt-in per environment**: the SDK then keeps one random `anonymousId` in
  local storage. Use it only where your consent rules allow it.
- **Not tracked** by the SDK: Global Privacy Control and Do Not Track (both respected by default),
  opted-out browsers (`optOut()`, `?no_track=1`), `setConsent("denied")`; with
  `requireConsent: true` nothing is sent before consent. Details: [SDK](sdk.md#behaviour).
- **No raw IP or user agent is stored.** The IP is used in memory for the hash, the optional
  country/region/city lookup (local GeoLite2 file, nothing leaves the server) and the
  internal-traffic filter; the user agent becomes browser, major version, OS and device type.
  Request logs drop client IPs and query strings.
- **URL query strings are stripped** before storage; only UTM parameters (and `ref`/`source`) are
  kept as attribution, plus parameters a project explicitly allowlists (≤ 20) and its site-search parameters.
- **PII guard** (default `strip`): values that look like an e-mail address or a Luhn-valid card number are dropped from user IDs,
  UTM values and properties (counted as `PII_DROPPED` on Data Health).
- **User IDs** are stored only when the project enables identify; otherwise `identify` is dropped
  and `userId` removed from events.
- Bots (user agent) are filtered and never stored.

## What is stored per event
Project, environment, event ID and type, time, visitor ID (and visit ID for browser events),
optional user ID, event name, hostname, path, route template, revenue + currency (server events),
referrer host and source, channel, UTM fields, country/region/city, browser, OS, device type,
screen class, language, and up to 8 KiB of flat custom properties. Schema:
`apps/api/migrations/0011_events_visits.sql`.

## Retention and deletion
- Per project: `retention_days` 7–3650, **unset = kept forever** (the operator chooses). A nightly
  job deletes older events and visits in chunks (ADR 0045).
- Data page → "Delete data": by date range, by visitor ID or by user ID; a resumable job with a
  progress record, audited. Backups keep deleted data until they expire (14 days by default).
- Account data (users, sessions, audit log) is kept while the organization exists.
