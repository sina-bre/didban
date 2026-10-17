-- Spec §7 steps 3–4 + §9.1: quota counters, ingestion diagnostics and rejected origins (ADR 0025).
-- Rows here are written by the ingestion process only; the dashboard reads them (Data Health, usage).

-- Platform admins set this; NULL = unlimited. Counted per UTC day over all of the organization's projects.
ALTER TABLE organizations
  ADD COLUMN daily_event_quota integer CHECK (daily_event_quota > 0);

-- One upsert per accepted batch (step 8, Stage 3c). The PK serves the quota sum per project and day.
CREATE TABLE project_usage_daily (
  project_id uuid    NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  day        date    NOT NULL,
  events     bigint  NOT NULL DEFAULT 0 CHECK (events >= 0),
  PRIMARY KEY (project_id, day)
);

-- Rejections by code and hour, flushed once a minute from memory. Retained 14 days (Stage 6 job).
CREATE TABLE ingestion_diagnostics (
  project_id     uuid        NOT NULL,
  environment_id uuid        NOT NULL,
  hour           timestamptz NOT NULL CHECK (date_trunc('hour', hour, 'UTC') = hour),
  code           text        NOT NULL CHECK (code ~ '^[A-Z_]{1,40}$'),
  count          integer     NOT NULL CHECK (count > 0),
  PRIMARY KEY (environment_id, hour, code),
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);

-- Rejected Origin values, at most 20 distinct per environment and UTC day (cap enforced on insert).
CREATE TABLE ingestion_rejected_origins (
  project_id     uuid        NOT NULL,
  environment_id uuid        NOT NULL,
  day            date        NOT NULL,
  origin         text        NOT NULL CHECK (char_length(origin) <= 255),
  count          integer     NOT NULL CHECK (count > 0),
  last_seen_at   timestamptz NOT NULL,
  PRIMARY KEY (environment_id, day, origin),
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);
