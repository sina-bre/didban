## 12. Security and privacy

- Security headers via Helmet on the API. CSP for the SPA with no inline scripts. If the vendored template needs inline styles, scope the exception to `style-src` only and document why.
- CORS: ingestion route allows the environment's configured origins dynamically (with `Vary: Origin`). Management routes allow no cross-origin access.
- Validate all configuration at startup with Zod and fail fast on missing or malformed values (public origin, trusted proxy setting, cookie mode, encryption key length, DB URL, GeoIP path).
- Logs: Pino with redaction for `authorization`, `cookie`, `set-cookie`, `x-write-key`, `password`, `token`, `secret`. Request IDs on every log line and every error response. Event payloads are never logged.
- Parameterized queries only. Run `pnpm audit` and fail CI on high/critical production-dependency advisories.
- Privacy controls implemented: cookieless default; no raw IP or UA persisted; daily salt destruction; GPC/DNT respected by default; consent gating; PII guard; per-project retention; deletion by range/visitor/user ID (chunked job with progress record); URL query stripping by default.
- State plainly in `docs/security.md` what is **not** claimed: no legal compliance is asserted. List which controls exist and what remains the operator's responsibility (privacy notice, lawful basis, DPA, consent UX where required).
