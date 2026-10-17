-- Spec §9.1: project settings columns, environments and write keys (ADR 0020).
-- Semantic checks (IANA time zone, origin and CIDR syntax) run in the app; the database keeps
-- hard caps so a bug cannot store unbounded data.

ALTER TABLE projects
  ADD COLUMN reporting_timezone      text    NOT NULL DEFAULT 'UTC' CHECK (char_length(reporting_timezone) <= 64),
  ADD COLUMN session_timeout_minutes integer NOT NULL DEFAULT 30 CHECK (session_timeout_minutes BETWEEN 5 AND 120),
  -- NULL keeps data forever.
  ADD COLUMN retention_days          integer CHECK (retention_days BETWEEN 7 AND 3650),
  ADD COLUMN allow_identify          boolean NOT NULL DEFAULT false,
  ADD COLUMN pii_guard               text    NOT NULL DEFAULT 'strip' CHECK (pii_guard IN ('strip', 'off')),
  ADD COLUMN url_param_allowlist     text[]  NOT NULL DEFAULT '{}' CHECK (cardinality(url_param_allowlist) <= 20),
  ADD COLUMN trailing_slash_policy   text    NOT NULL DEFAULT 'strip' CHECK (trailing_slash_policy IN ('strip', 'keep'));

CREATE TABLE environments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  name            text NOT NULL CHECK (name ~ '^[a-z][a-z0-9-]{0,31}$'),
  identity_mode   text NOT NULL DEFAULT 'cookieless' CHECK (identity_mode IN ('cookieless', 'persistent')),
  allowed_origins text[] NOT NULL DEFAULT '{}' CHECK (cardinality(allowed_origins) <= 50),
  excluded_cidrs  text[] NOT NULL DEFAULT '{}' CHECK (cardinality(excluded_cidrs) <= 50),
  track_localhost boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Also serves "environments of a project" and the projects foreign key.
  UNIQUE (project_id, name),
  -- Target of the composite foreign key from api_keys.
  UNIQUE (id, project_id)
);

CREATE TABLE api_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  environment_id uuid NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('write_browser', 'write_server')),
  -- Shown in the UI; never enough to use the key.
  prefix         text NOT NULL UNIQUE CHECK (char_length(prefix) = 16),
  -- SHA-256 of the whole 256-bit random token (spec §9.1: no Argon2 needed).
  secret_hash    bytea NOT NULL UNIQUE CHECK (octet_length(secret_hash) = 32),
  created_by     uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  -- A key can only point at an environment of its own project.
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);

-- Listing a project's keys, counting an environment's active keys, and the composite FK check.
CREATE INDEX api_keys_project_environment_idx ON api_keys (project_id, environment_id);
