# Metrics

How didban derives the values it reports (spec §4). This file covers what is built so far:
visitors, visits, the overview KPIs and time series, filters, channels, route grouping and
discovered pages. Goals and revenue follow in Stage 4c.

## Visitors

Each environment picks an identity mode. A visitor ID is 16 bytes; raw IPs and user agents are
never stored.

- **Cookieless** (default): a hash of a daily random salt, the project, the client IP and the user
  agent. The salt changes at 00:00 UTC and old salts are deleted after at most 48 h. **A returning
  person gets a new visitor ID every UTC day**, so a multi-day visitor count is the sum of daily
  unique visitors and overcounts returning people. The salt is picked by the time the server
  *receives* a batch: events sent after midnight hash with the new day's salt.
- **Persistent**: the SDK's stored `anonymousId`. Without one (for example before consent), the
  cookieless hash is used.
- **Server events** (server write keys) use `anonymousId` when present, else `userId`; one of them is
  required. With `anonymousId` in persistent mode they share the browser visitor ID, but they never
  join or create a visit and never count toward visitors, visits or bounce.
- User IDs are stored only when the project allows identify. Otherwise `identify` events from the
  browser are dropped and `userId` is removed from other events.
- Different projects never share visitor IDs (the project is part of every hash).

## Visits

A visit is a run of one visitor's browser events with no gap longer than the project's session
timeout (default 30 min, 5–120). The server assigns visits; the client never sends one.

- Events are placed in time order. An event joins a stored or new visit when it lies within the
  timeout of that visit's first or last event, so a late batch rejoins the visit it belongs to.
- In cookieless mode visits also split at 00:00 UTC, because the visitor ID changes.
- **Entry / exit page**: pathname of the first / last page view. A visit with only custom events
  has none.
- **Source attribution** is first-touch: UTM parameters and referrer of the first page view.
- A retried event (same `eventId`) is stored once and counted once, in events and in visits.

## Overview KPIs (`GET …/stats/overview`)

Ranges are `[from, to)` in UTC, at most 366 days. With filters, events must match every filter.

| KPI | Definition |
|---|---|
| Visitors | distinct visitor IDs of **browser** events in the range (server events never count) |
| Visits | visits that **started** in the range; with filters, only visits containing a matching event |
| Page views | `page` events in the range (browser and server keys) |
| Views per visit | page views of the counted visits ÷ visits |
| Bounce rate | visits with exactly one page view and no other event ÷ visits (0–1). Module events such as `scroll_depth` or `engaged_time` are events, so such a visit is not a bounce |
| Visit duration | average of last − first event (or engaged time when longer), zero-length visits included |

- Totals are distinct counts over the whole range, never sums of buckets: in cookieless mode a
  person seen on two UTC days is two visitors, but one visitor seen in two hours of one day is one.
- **Comparison**: `previous_period` = the range of the same length right before; `previous_year` =
  the same instants one UTC calendar year earlier. Change is in percent and `null` when the
  previous value is 0 or missing.
- Rates and averages are `null` when there are no visits.

## Time series (`GET …/stats/timeseries`)

- Buckets are hours, days, ISO weeks (Monday) or months **of the project's reporting time zone**,
  DST-correct: a fall-back day has 25 hours and its repeated local hour is two buckets; a
  spring-forward day has 23 hours; Asia/Tehran days start at 20:30 UTC. Each point's `start` is the
  bucket's first instant in UTC; empty buckets are included.
- `auto` interval: ≤ 2 days → hour, ≤ 92 days → day, ≤ 183 days → week, else month. At most 1000
  buckets per request.
- Events go to the bucket of their `occurred_at`, visits to the bucket of their `started_at`.

## Filters

`filter=field:op:value` (repeatable, ≤ 10; ops `eq`, `neq`, `contains`, `in` with `|`-separated
values). Fields: `hostname pathname route name channel referrer utm_* country region city browser
os device_type screen language`, and `prop.<key>` for custom properties. Channel, device type and
screen take names (`channel:eq:organicSearch`, `device_type:eq:mobile`, `screen:eq:phone`).
`contains` is case-insensitive; `neq` also keeps rows where the field is empty.

## Channels

Ingestion assigns every event one channel (a `smallint` code in `events.channel`). The codes are `CHANNELS` in `@didban/contracts`. The rules are in `apps/api/data/channels.json`.
The referrer hosts are in `apps/api/data/sources.json`.

| Code | Channel | Assigned when |
|---|---|---|
| 0 | Direct | no external referrer and no UTM parameters |
| 1 | Organic Search | `utm_medium=organic`, or the referrer is a known search engine |
| 2 | Paid Search | `utm_medium` is `cpc`, `ppc` or `paidsearch` |
| 3 | Social | `utm_medium=social`, or the referrer is a known social network |
| 4 | Email | `utm_medium=email`, or the referrer is a known webmail host |
| 5 | Referral | any other external referrer, or UTM parameters with an unknown medium and no referrer |

The checks run in this order. The first one that matches decides the channel:

1. **`utm_medium`**, lowercased, looked up in `mediums`. A known medium wins over the referrer.
2. **Referrer source type** from `sources.json` (`search`, `social`, `email`, `referral`).
3. **Referral** if the referrer is external but unknown, or the URL has any UTM parameter.
4. **Direct** otherwise.

Notes:
- `ref` and `source` query parameters stand in for a missing `utm_source`. They do not set a medium.
- A **self-referral** counts as no referrer: the referrer host is the page's own host or the host
  of one of the environment's allowed origins. `www.` is ignored on both sides.
- Only the referrer **host** is kept, never its path or query.
- A host matches a source entry for that domain and its subdomains. `google.*` matches Google's
  country domains (`google.de`, `google.co.uk`).
- Channels are fixed when the event is stored. A later change to the rule files does not
  re-classify stored events.

## Route grouping

The `route` of a page event groups dynamic paths so reports do not split `/products/1`,
`/products/2`, … into separate rows. Templates are managed per project under
`/api/v1/projects/:projectId/routes` (project admins and org owners/admins).

- `:name` matches exactly one path segment. A trailing `*` matches the rest (zero or more segments).
  Every other segment must match literally. Raw regular expressions are not accepted.
- Templates are tried in `position` order. The first match is stored in `route`. With no match,
  the sanitized pathname is stored.
- At most 200 templates per project. `POST …/routes/preview` shows which template a set of paths
  would match, for the saved templates or for a list of patterns that are not saved yet.
- Changes apply to new events within 60 seconds (settings cache). Stored events keep their route.

## Discovered pages

Every new (hostname, route) of a page view is recorded with its first and last time seen and the
latest title. A project keeps at most 10 000 of them. Past that, new routes are recorded under the
single route `/__other__` and Data Health shows a warning: add route templates to group them.
