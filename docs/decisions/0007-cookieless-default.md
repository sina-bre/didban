# 0007 — Cookieless identity is the default

- Status: Accepted (locked by spec §4)
- Date: 2026-10-17

## Decision
`visitor_id = first 16 bytes of SHA-256(daily_salt || project_id || ip || normalized_ua)`. The salt rotates at
00:00 UTC and is destroyed after 48 h. `persistent` mode (random `anonymousId` in storage) is opt-in per environment.

## Consequences
No browser storage, and no consent needed for identity in the default mode. Multi-day visitor counts overcount
returning people, so the dashboard labels them "daily-unique visitors" in cookieless mode. Visits split at midnight UTC.
