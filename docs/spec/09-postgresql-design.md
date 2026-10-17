## 9. PostgreSQL design

### 9.1 Metadata tables (Prisma-managed)

`organizations`, `users`, `memberships(user_id, organization_id, role)`, `project_members`, `projects`, `environments`, `api_keys`, `goals`, `route_templates`, `pages_seen`, `share_links`, `auth_sessions`, `invites`, `totp_credentials`, `totp_recovery_codes`, `audit_logs`, `ingestion_diagnostics`, `project_usage_daily`, `daily_salts`.

- UUID primary keys; unique constraints on `(organization_id, slug)`, `(project_id, environment name)`, `memberships(user_id, organization_id)`.
- `ON DELETE RESTRICT` by default. Projects are archived (`archived_at`), not hard-deleted. Hard-deleting a project is an explicit job that deletes its events in chunks first.
- Project columns: `name`, `slug`, `reporting_timezone` (IANA, validated), `session_timeout_minutes`, `retention_days` (nullable = forever), `allow_identify`, `pii_guard`, `url_param_allowlist`, `trailing_slash_policy`, `archived_at`.
- Environment columns: `name`, `identity_mode`, `allowed_origins text[]`, `excluded_cidrs text[]`, `track_localhost`.
- API keys: `kind` (`write_browser` | `write_server`), `prefix` (indexed, shown in UI), `secret_hash` (SHA-256 of the high-entropy token; Argon2 is unnecessary for 256-bit random secrets), `last_used_at` (updated at most once per minute per key, in memory then flushed), `revoked_at`. Browser write keys are public by design; they cannot read anything.
- `memberships.role IN ('owner','admin','member')`. An organization must always keep at least one `owner` (enforced in the use case and tested).
- `users.is_platform_admin boolean NOT NULL DEFAULT false`: set only through the CLI (`pnpm cli grant-platform-admin <email>`), never through the HTTP API.
- `project_members(project_id, organization_id, user_id, role)` with `role IN ('project_admin','viewer')`, unique `(project_id, user_id)`. A row is valid only if the user is a member of the project's organization (composite foreign keys through `organization_id`).
- `route_templates(project_id, position, pattern)`, unique `(project_id, pattern)`, max 200 per project.
- `pages_seen(project_id, environment_id, hostname, route, first_seen_at, last_seen_at, last_title)`, PK `(project_id, environment_id, hostname, route)`. **Capped at 10 000 rows per project.** Past the cap, new routes are recorded under the single literal route `/__other__`, a metric is incremented, and Data Health shows a warning telling the operator to add route templates.
- `ingestion_diagnostics(project_id, environment_id, hour, code, count)` plus a bounded rejected-origins table (section 7, step 3). Retained 14 days.

### 9.2 `events` (append-heavy, hand-written SQL migration)

```text
project_id        uuid        NOT NULL
environment_id    uuid        NOT NULL
event_id          uuid        NOT NULL
type              smallint    NOT NULL   -- 1 page, 2 track, 3 identify
occurred_at       timestamptz NOT NULL   -- effective, skew-corrected
received_at       timestamptz NOT NULL
visitor_id        bytea       NOT NULL   -- 16 bytes
source            smallint    NOT NULL   -- 1 browser, 2 server (from key kind)
visit_id          uuid        NULL       -- NULL for server events
user_id           text        NULL
name              text        NULL       -- track events
hostname          text        NOT NULL
pathname          text        NOT NULL
route             text        NOT NULL   -- matched route template, else pathname
revenue           numeric(14,2) NULL
currency          char(3)     NULL
referrer_host     text        NULL
referrer_source   text        NULL
channel           smallint    NOT NULL
utm_source / utm_medium / utm_campaign / utm_term / utm_content   text NULL
country char(2) NULL, region text NULL, city text NULL
browser text NULL, browser_major smallint NULL, os text NULL, device_type smallint NULL
screen_class smallint NULL, language text NULL
properties        jsonb       NOT NULL DEFAULT '{}'
PRIMARY KEY (project_id, event_id)
```

CHECK constraints for: `type IN (1,2,3)`, `char_length` caps on every text column, `pg_column_size(properties) <= 8192`, `jsonb_typeof(properties) = 'object'`, `source IN (1,2)`, `(revenue IS NULL) = (currency IS NULL)`, `source = 1 OR visit_id IS NULL`.

Indexes (each secondary index costs write throughput; keep to these and prove any addition with `EXPLAIN (ANALYZE, BUFFERS)`):
1. PK `(project_id, event_id)`. UUIDv7 keeps inserts roughly ordered.
2. `(project_id, environment_id, occurred_at DESC)`: base range scans.
3. `(project_id, name, occurred_at DESC) WHERE type = 2`: event reports.

No GIN on `properties` in v1. Property filters run against the range-narrowed rows. Trigger for adding an index is in section 20.

### 9.3 `visits`

```text
project_id uuid, visit_id uuid, environment_id uuid, visitor_id bytea,
started_at timestamptz, last_seen_at timestamptz,
entry_pathname text, exit_pathname text,
pageviews int, events int,
referrer_source text, channel smallint, utm_* text, country char(2),
browser text, os text, device_type smallint, engaged_ms int NULL
PRIMARY KEY (project_id, visit_id)
INDEX (project_id, visitor_id, last_seen_at DESC)   -- visit resolution on ingest
INDEX (project_id, started_at DESC)
```

### 9.4 Time, retention, partitioning, rollups

- All timestamps are `timestamptz` in UTC. Bucketing uses the project's reporting time zone: `date_trunc(interval, occurred_at AT TIME ZONE tz)`.
- **Retention job (nightly):** deletes expired events in bounded chunks (default 10 000 rows per statement, short sleep between), then expired visits, then expired auth sessions/invites. Logs rows deleted and duration. Guarded by advisory lock.
- **No partitioning in v1.** When the section-20 trigger fires, implement monthly range partitioning on `occurred_at`, app-managed (a job creates the next two partitions; no extensions). **Deduplication must then move to a separate unpartitioned `event_ids(project_id, event_id, seen_at)` table with a 72 h window**, cleaned hourly, because skew correction changes `occurred_at` slightly between retries. A unique key that includes `occurred_at` would silently stop deduplicating retries. Retention then becomes `DROP PARTITION`.
- **No rollup tables in v1.** Unique visitors are not additive across buckets, so rollups of uniques are wrong by construction. When the trigger fires, add daily rollups for counts only (page views, event counts, visits); keep unique-visitor queries on raw rows with the range cap.

### 9.5 Connections and timeouts

- One Prisma client per process. Bounded pool via connection string parameters.
- Pool sizing rule: `replicas × pool_size ≤ 0.8 × (max_connections − reserved_for_admin_migrations_backups)`. Document the computed numbers for the target box.
- Roles: `analytics_migrator` (DDL, used only by the deploy script) and `analytics_app` (DML only, no DDL, no superuser). `ALTER ROLE analytics_app SET statement_timeout = '15s', idle_in_transaction_session_timeout = '30s', lock_timeout = '5s'`. Ingestion transactions set a shorter local timeout.
- Graceful shutdown: stop accepting, drain in-flight transactions (≤ 25 s), then `$disconnect()`.
