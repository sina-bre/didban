# HTTP API

All routes live under `/api/v1` on the same origin as the dashboard, except `GET /metrics` (root,
bearer token, never proxied: ADR 0049). Request and response shapes are the Zod schemas in
`packages/contracts`. **No OpenAPI document is generated yet** (spec §2 asks for one from the Zod
schemas; see [known limitations](known-limitations.md)).

## Errors
One body everywhere: `{ "error": { "code", "message", "requestId" } }`. No stack traces, SQL or
key material; `x-request-id` is on every response. "Missing" and "not yours" are the same `404`.

### Ingestion (`POST /ingest/batch`, spec §6.5, `packages/contracts/src/error-codes.ts`)
| Code | HTTP | SDK retries? |
|---|---|---|
| `INVALID_JSON`, `INVALID_ENVELOPE`, `UNSUPPORTED_SCHEMA_VERSION`, `BATCH_TOO_LARGE`, `TOO_MANY_VISITORS_IN_BATCH` | 400 | No |
| `INVALID_WRITE_KEY`, `WRITE_KEY_REVOKED` | 401 | No |
| `ORIGIN_NOT_ALLOWED` | 403 | No |
| `PAYLOAD_TOO_LARGE` | 413 | No (halves the batch once, then drops) |
| `RATE_LIMITED` | 429 + `Retry-After` | Yes, honouring `Retry-After` (≤ 60 s) |
| `QUOTA_EXCEEDED` | 429 | No until the next quota window |
| `INTERNAL_ERROR` | 500 | Yes |
| `SERVICE_UNAVAILABLE` | 503 | Yes |
| Network error, timeout, 408, 502, 504 | n/a | Yes |

A `200` means committed to PostgreSQL: `{ accepted, duplicates, rejected: [{ index, code, path }],
requestId }`, with per-event codes `INVALID_EVENT`, `EVENT_IN_FUTURE`, `EVENT_TOO_OLD`. Bot-filtered
and internal-traffic events count as accepted.

### Management and stats
| Code | HTTP | When |
|---|---|---|
| `BAD_REQUEST`, `VALIDATION_FAILED`, `INVALID_JSON` | 400 | Malformed body or query |
| `INVALID_ORGANIZATION_NAME`, `PASSWORD_UNCHANGED` | 400 | Rule violations |
| `UNAUTHENTICATED` | 401 | No or expired session |
| `INVALID_CREDENTIALS` | 401 | Login failed (same body for unknown accounts) |
| `FORBIDDEN` | 403 | Role too low inside a resource you can see; non-admin on `/admin/*` |
| `CSRF_REJECTED` | 403 | State change without a same-origin `Origin` / `Sec-Fetch-Site` |
| `PASSWORD_CHANGE_REQUIRED` | 403 | Temporary password not changed yet |
| `RESET_NEEDS_OPERATOR` | 403 | Reset of an account an owner may not reset (use `pnpm cli`) |
| `NOT_FOUND` | 404 | Missing, not yours, malformed ID |
| `METHOD_NOT_ALLOWED` | 405 | |
| `EMAIL_TAKEN`, `ENVIRONMENT_EXISTS`, `GOAL_EXISTS`, `ROUTE_TEMPLATE_EXISTS` | 409 | Duplicate |
| `KEY_LIMIT_REACHED`, `GOAL_LIMIT_REACHED`, `ROUTE_TEMPLATE_LIMIT`, `SHARE_LINK_LIMIT_REACHED`, `DELETION_LIMIT_REACHED` | 409 | Feature-catalog limits (spec §23) |
| `LAST_OWNER` | 409 | Removing or demoting the last owner |
| `USE_CHANGE_PASSWORD` | 409 | Owner tried to reset their own password |
| `PAYLOAD_TOO_LARGE` | 413 | Body over the limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | State change without `application/json` |
| `RATE_LIMITED` | 429 + `Retry-After` | Login limits, stats gate per project |
| `INTERNAL_ERROR` | 500 | Bug (logged with the request ID) |
| `SERVICE_UNAVAILABLE` | 503 | Database busy or unreachable, stats gate full |

## Routes (prefix `/api/v1`)
Permissions in brackets (`domain/permissions.ts`, ADR 0019); unlisted = signed-in user.
- **Public:** `GET /health/live`, `GET /health/ready`, `POST /auth/login`, `POST /ingest/batch`
  (write key), `GET /share`, `GET /share/stats/:report` (share token).
- **Auth:** `GET /auth/me`, `POST /auth/logout`, `/auth/logout-all`, `/auth/password`.
- **Organizations:** `GET /organizations`; `GET|PATCH|DELETE /organizations/:organizationId/members[/:userId]`;
  `POST …/users`, `POST …/members/:userId/password-reset`; `GET|POST|PATCH …/projects[/:projectId]`;
  `GET …/audit-log`.
- **Projects** [project:view / manage / members]: `GET /projects`, `GET|PATCH /projects/:projectId`,
  `GET|PUT|DELETE …/members[/:userId]`, `GET|POST|PATCH …/environments[/:environmentId]`,
  `GET …/keys`, `POST …/environments/:environmentId/keys`, `DELETE …/keys/:keyId`,
  `GET|POST|PATCH|DELETE …/goals`, `…/routes` (+ `POST …/routes/preview`), `GET|POST|DELETE …/shares`,
  `GET|POST …/deletions`.
- **Stats** [project:view] `…/projects/:projectId/stats/`: `overview`, `timeseries`, `pages`,
  `pages/detail`, `sources`, `geo`, `devices`, `events`, `events/:name/properties`, `goals`,
  `realtime`, `data-health`, `export.csv`. Query: range or `?range=` (ADR 0046), filters, comparison
  ([metrics](metrics.md)).
- **Platform admin** [platform]: `GET /admin/organizations|users|instance`, `POST|PATCH
  /admin/organizations[/:organizationId]`, `POST /admin/organizations/:organizationId/owners`.
- **Outside the prefix:** `GET /metrics` (`Authorization: Bearer $METRICS_TOKEN`; 404 when unset).
