# 0036 — Goals and share links

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 4c (spec §3.1, §4, §11, catalog 23.2/23.3): goals on an event name or a page path pattern
with conversion rate and revenue per currency; public read-only share links, revocable, token
stored hashed, optional expiry, reaching only an enumerated set of stats endpoints.

## Decision
- Migration 0012: `goals` (kind `event` | `page`, CHECKs tie the matching field to the kind,
  unique name per project) and `share_links` (SHA-256 `token_hash` unique, `expires_at`,
  `revoked_at`, `created_by`). Caps (50 goals, 20 active links) are checked under a project row
  lock. Every change is audited (`goal.*`, `share_link.*`), field names only.
- Page goals reuse the route-template syntax. `templateRegex` turns a parsed template into an
  anchored regex (`[^/]+` per parameter, one optional tail) bound as a parameter; a test proves it
  agrees with ingestion's matcher. One query per report joins all goals (`unnest`) to events.
- Share tokens: `dsh_` + 256 random bits, shown once. The public view takes the token from the
  `X-Share-Token` header (redacted in logs), never from the URL. `ShareViewController` maps an
  explicit list of reports to the same use cases with a synthetic viewer scope for that one
  project, so the existing `projectInScope` checks still apply; unknown names are `404`
  (own-property lookup, no prototype keys). Revoked/expired links, archived projects and
  suspended organizations are `404`, like a missing resource.

## Consequences
The shareable URL carries the token in the fragment (`/share#dsh_…`): browsers never send a
fragment to servers or in `Referer`. The dashboard's share page reads it once and sends it as the
header. Token lookups are not cached, so revocation takes effect on the next request.
