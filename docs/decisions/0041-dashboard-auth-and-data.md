# 0041 — Dashboard sign-in, API client, server state and report ranges

- Status: Accepted
- Date: 2026-10-26

## Context
Stage 5c connects the dashboard to the API (spec §11, §13.3, §13.4). The spec names
`/accept-invite/:token`, but addendum A9 and ADR 0024 removed invites: users get a temporary
password and must change it at first login, and the API has no invite route. The spec also leaves
open what a lost session does to cached data, how report days map to instants, how comparison is
stored, and how Realtime stops while the tab is hidden.

## Decision
- **Auth pages:** `/login` and `/set-password` (the first-login change, `POST /auth/password`)
  replace `/accept-invite`. `RequireAuth` (`GET /auth/me`) guards everything else and sends a
  temporary-password session to `/set-password?next=`. Forms: React Hook Form + the contract Zod
  schemas (spec §13.1); that code is a lazy chunk (14 KB gz) loaded only by the auth pages.
- **One `api-client.ts`:** same-origin `/api/v1`, JSON with its content type (CSRF rule),
  `AbortSignal` from TanStack Query, every failure an `ApiError` in the contract shape (the
  `x-request-id` header when the body is not ours; `NETWORK_ERROR` for a failed fetch; an abort
  stays an abort). A 401 other than `INVALID_CREDENTIALS` is a lost session: a **full page load** of
  `/login?next=<path+search>`, so no cached data of the old session survives. `next` is used only if
  it resolves to this origin (no open redirect). A successful login clears the query cache.
- **TanStack Query:** `staleTime` 30 s (the API caches stats 15 s), retries only for network errors
  and 5xx (twice), reports keep the previous data while a new range loads. Org and project lists come
  from the server already filtered; organizations without an accessible project are left out of the
  switcher. A project that answers 404 (missing or forbidden, spec §11) renders "not found".
- **Report ranges** are whole days in the project's reporting time zone (`@internationalized/date`,
  already a dependency): `from` = first midnight, `to` = the midnight after the last day. The query and
  its cache key stay the same all day. Comparison is `?compare=previous_period` (a switch).
- **Realtime:** `refetchInterval` 10 s with `refetchIntervalInBackground: false`; TanStack's focus
  manager follows `visibilitychange`, and showing the tab refetches at once.
- `/projects` opens the first accessible project until the project list arrives with onboarding (5e).

## Consequences
Initial JS grows from 103.6 to 122.0 KB gz (TanStack Query, guards; budget 180). The report header's
range label is still computed in the browser's zone; it differs from the query only when the
browser and project zones disagree on the date (revisit in 5d with the interval selector). E2E sets
the API's `PUBLIC_ORIGIN` to the dashboard origin and seeds two users with Argon2id hashes. Revisit
the full-page 401 if the dashboard ever needs to keep unsaved form input across a re-login.
