# 0017 — Password hashing, password policy and login limits

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §11 asks for Argon2id "at or above the current OWASP minimums for the library used" (recorded in an
ADR), a bundled common-password list, rate limits per IP / account / (IP, account) with progressive delay
instead of hard lockout, and an explicit cookie-mode switch. Spec §2 keeps rate limiting in memory in v1.

## Decision
- **Library:** `@node-rs/argon2` 2.2.2 (ADR 0001; prebuilt binaries, no node-gyp on Windows). Node 24's
  built-in `crypto.argon2` exists but is experimental, so it is not used for credentials yet.
- **Parameters:** Argon2id, m = 19 456 KiB (19 MiB), t = 2, p = 1, 32-byte output, 16-byte random salt
  per hash: the first OWASP Password Storage configuration. Measured on the dev box: verify median 32.8 ms (28–37 ms, 10 runs). A stored
  hash with weaker parameters is rehashed on the next successful login (`needsRehash`).
- **Unknown accounts** verify against a real dummy hash (computed once per process), so both failure
  paths do the same work and return the same `401 INVALID_CREDENTIALS` body.
- **Policy:** 12–128 Unicode code points, no composition rules, lower-cased match against
  `apps/api/data/common-passwords.txt` (SecLists 10k, MIT, owner-approved 2026-10-17). Only 10 of those
  entries are ≥ 12 characters, so the list adds little on top of the length rule today; a larger list
  (e.g. NCSC 100k) is a drop-in file swap.
- **Login limits (in memory, per process, 15-minute windows of failures):** (IP, account) 5 → 429;
  IP 30 → 429; account: after 5 failures a delay of 1 s doubling per failure, capped at 60 s, across all
  IPs. Success clears the account and pair buckets. At most 50 000 buckets (oldest evicted first).
  `429 RATE_LIMITED` carries `Retry-After`. Change-password uses the same limiter.
- **CSRF:** a Fastify `onRequest` hook on non-GET/HEAD/OPTIONS requests, except `/api/v1/ingest/*`:
  `Origin` must equal `PUBLIC_ORIGIN` (or, without `Origin`, `Sec-Fetch-Site: same-origin`), else
  `403 CSRF_REJECTED`; content type must be `application/json`, else `415`. Bodyless actions
  (logout) send `{}`.
- **Cookie mode:** `SESSION_COOKIE=secure|insecure-dev` (default `secure`). `secure` needs an https
  `PUBLIC_ORIGIN`; `insecure-dev` is refused in production. Startup fails otherwise.
- **Sessions:** `auth_sessions_user_idx` exists for "log out everywhere" / password change deletes by
  user (also the FK side of `user_id`). No `EXPLAIN` before/after: the table is new and empty.

## Consequences
Limits reset on restart and are per process; with more than one API replica, move the limiter to a
shared store (spec §20 trigger). Raising Argon2 parameters later costs nothing to existing users beyond
one slower login. Expired session rows are filtered on read and purged by the Stage 6 retention job.
