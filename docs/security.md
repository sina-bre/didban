# Security

What exists, what it protects, and what is **not** claimed (spec §11, §12). Reporting a
vulnerability: [`SECURITY.md`](../SECURITY.md). Tenancy rules: [tenancy](tenancy.md).

## Trust model
- **Anyone with server or database access is trusted by definition.** There is no encryption of
  data at rest by the app, no impersonation feature, and no protection against the operator.
- A platform admin who is not a member of an organization cannot read its analytics or project
  data through the app (tested). They can with `psql`, like any operator.
- Write keys are **public** in browser bundles. The per-environment `Origin` allowlist is a spam
  filter, not authentication: anything outside a browser can send any `Origin` header. It keeps
  honest browsers on other sites from writing into your project, nothing more. Server write keys
  (`write_server`) are secrets and skip the origin check; never ship one to a browser.
- Write keys can only write. They cannot read anything.

## Controls
| Area | Control | Where |
|---|---|---|
| Passwords | Argon2id (19 MiB, t=2), 12–128 chars, common-password list, same work for unknown accounts | ADR 0017 |
| Login | Per (IP, account), per IP and per account limits with backoff, `429` + `Retry-After` | ADR 0017 |
| Sessions | Opaque 256-bit tokens stored as SHA-256, `__Host-sid` cookie `Secure; HttpOnly; SameSite=Lax`; log out everywhere; revoked on password change/reset | ADR 0009 |
| Accounts | No signup, no invites; temporary passwords (~115 bits) shown once, forced change | ADR 0024 |
| CSRF | Same-origin `Origin` / `Sec-Fetch-Site` check + `application/json` on every state change | ADR 0017 |
| Authorization | One guard, pure rules, fail closed; route-coverage test; 404 for "not yours" | ADR 0019, [tenancy](tenancy.md) |
| Input | Zod schemas from `packages/contracts` on every body and query; 128 KiB body limit read on the stream; malformed IDs → 404 | ADR 0025 |
| SQL | postgres.js tagged templates only (bound values); app role has DML only, no DDL | ADR 0016 |
| Errors | One body shape, fixed messages, no stacks/SQL/keys; request ID on every response | [api](api.md) |
| Logs | Pino; redacts `authorization`, `cookie`, `set-cookie`, `x-write-key`, `x-share-token`, passwords, tokens, secrets, write keys; no client IPs, query strings or event payloads | `http/logger-options.ts` |
| Headers | HSTS, CSP without inline scripts, `X-Frame-Options: DENY`, `nosniff`, set by Caddy (Helmet replaced, ADR 0047); API binds 127.0.0.1 | `deploy/caddy/Caddyfile` |
| CORS | Ingest only, per-environment origins with `Vary: Origin`; management routes none | `http/ingest-cors.ts` |
| Config | Validated at startup, production refuses http/IP origins and insecure cookies | `config/env.ts` |
| Metrics | `/metrics` behind a ≥ 32-char bearer token, never proxied, 404 when unset | ADR 0049 |
| Share links | Read-only, per-project, revocable token; only the share-view reports | ADR 0036 |
| Audit | Organization audit log of membership, key, project and user changes (no secrets) | ADR 0022 |
| Dependencies | `pnpm audit`: 0 known advisories on 2026-11-02 (overrides, ADR 0051) | |

## Not claimed
- **No legal compliance (GDPR, ePrivacy, CCPA, …) is asserted.** The app provides controls
  ([privacy](privacy.md)); whether a deployment is lawful is the operator's decision.
- The operator is responsible for: a privacy notice, the lawful basis, a DPA with their own
  customers where needed, consent UX where required (the SDK offers `requireConsent`), choosing
  retention, answering access and deletion requests (the Data page deletes by visitor or user ID),
  TLS certificates, OS and PostgreSQL patching, backups off the box and firewalling.
- No TOTP / two-factor yet, no SSO, no account lockout e-mails (there is no e-mail at all).
  See [known limitations](known-limitations.md).
