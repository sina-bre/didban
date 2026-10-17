## 10. Analytics API rules

Base path `/api/v1`. All routes under `/projects/:projectId/stats/*` require a session (or a valid share-link token, read-only) **and** a membership check for that project's organization. The project ID from the URL is never trusted by itself.

Common query parameters: `from`, `to` (UTC, `[from, to)`), `interval` (`auto|hour|day|week|month`), `compare` (`none|previous_period`), repeated `filter=field:op:value` (ops: `eq`, `neq`, `contains`, `in`), `limit` (default 10, max 100), `environmentId`.

Endpoints: `GET …/stats/overview`, `…/timeseries`, `…/realtime`, `…/pages` (`?view=top|entry|exit|discovered`), `…/pages/detail?hostname=…&route=…`, `…/sources` (`?by=referrer|channel|utm_source|utm_medium|utm_campaign|utm_term|utm_content`), `…/geo`, `…/devices` (`?by=browser|os|device_type|screen|language`), `…/events`, `…/events/:name/properties`, `…/goals` (counts, browser-only conversion rate, revenue per currency), `…/data-health`, `…/export.csv`. Route templates are managed under `…/routes` (CRUD, project admin and above), with `POST …/routes/preview` taking sample paths and returning the matched template so patterns can be tested before saving. Organization and project management routes live outside `…/stats`, under `/organizations/:organizationId/…` and `/projects/:projectId/…`; platform-admin routes live under `/admin/…` and are rejected for non-admins with `404`.

Every response includes `meta`: `{ from, to, interval, timezone, compare, identityMode, truncated, generatedAt }`.

Query safety (all tested):
- **Filter fields come from an allowlist mapped to column names.** User input never reaches SQL as an identifier. Values are bound parameters. Property filters use `properties ->> $key` with `$key` validated by the property-key regex and passed as a parameter.
- Max range 366 days. Max 10 filters. Max 100 rows per breakdown. `SET LOCAL statement_timeout = '10s'` for stats queries.
- At most 3 concurrent expensive stats queries per project (in-process semaphore; queue wait ≤ 2 s, then `429`).
- 15 s per-process LRU response cache keyed by `(project, normalized query)`. Document that it is per process. Realtime is never cached.
- Aggregates are not paginated. Raw event listing (`GET …/events/raw`, admin+ only) uses cursor pagination on `(occurred_at, event_id)`.
- Management endpoints (projects, keys, users, invites, shares, deletion, audit) get their own limiter.
