# Metrics

How didban derives the values it reports (spec §4). This file covers what is built so far:
channels and route grouping. Visitors, visits, bounce, duration and goals are added with the
stages that build them (3c onward).

## Channels

Ingestion assigns every event one channel (a `smallint` code; stored in `events.channel` once
Stage 3c writes events). The codes are `CHANNELS` in `@didban/contracts`. The rules are in `apps/api/data/channels.json`.
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
