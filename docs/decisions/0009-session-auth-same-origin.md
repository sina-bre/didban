# 0009 — Server-side sessions on a same-origin dashboard

- Status: Accepted (locked by spec §2, §11, §14.0)
- Date: 2026-10-17

## Decision
Opaque 256-bit session tokens, stored as SHA-256 in `auth_sessions`, sent in a `__Host-sid` cookie
(`Secure; HttpOnly; SameSite=Lax`). Dashboard and API share one origin behind Caddy, so CSRF protection is an
`Origin` / `Sec-Fetch-Site` check plus a JSON content type. No JWT, no OAuth, no refresh tokens.

## Consequences
Instant revocation, nothing secret in JS. If the dashboard and API ever move to different sites, switch to
double-submit CSRF tokens and revisit `SameSite` (trigger in spec §20).
