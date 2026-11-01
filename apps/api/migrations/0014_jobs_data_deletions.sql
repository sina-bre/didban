-- Spec §9.4 retention job + §12 deletion by range/visitor/user ID (chunked job, progress record) +
-- §15 job last-success timestamps. ADR 0045.

-- One row per background job; the runner writes it after every run (the metrics source in 6c).
CREATE TABLE job_runs (
  job             text        PRIMARY KEY CHECK (job ~ '^[a-z_]{1,40}$'),
  last_started_at timestamptz NOT NULL,
  last_success_at timestamptz,
  last_error      text        CHECK (char_length(last_error) <= 500),
  last_rows       bigint      NOT NULL DEFAULT 0 CHECK (last_rows >= 0),
  last_duration_ms integer    NOT NULL DEFAULT 0 CHECK (last_duration_ms >= 0)
);

-- A deletion request is the progress record: `cursor_at` is how far the scan has come, so a
-- restarted process resumes where the last one stopped. Visitor IDs are the 16-byte hash, never
-- the anonymous ID the operator typed.
CREATE TABLE data_deletions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  kind           text        NOT NULL CHECK (kind IN ('range', 'visitor', 'user')),
  from_at        timestamptz,
  to_at          timestamptz,
  visitor_id     bytea       CHECK (octet_length(visitor_id) = 16),
  user_id        text        CHECK (char_length(user_id) BETWEEN 1 AND 128),
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'running', 'done', 'failed')),
  cursor_at      timestamptz,
  events_deleted bigint      NOT NULL DEFAULT 0 CHECK (events_deleted >= 0),
  visits_deleted bigint      NOT NULL DEFAULT 0 CHECK (visits_deleted >= 0),
  error          text        CHECK (char_length(error) <= 500),
  requested_by   uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  CHECK ((kind = 'range') = (from_at IS NOT NULL AND to_at IS NOT NULL)),
  CHECK (from_at IS NULL OR from_at < to_at),
  CHECK ((kind = 'visitor') = (visitor_id IS NOT NULL)),
  CHECK ((kind = 'user') = (user_id IS NOT NULL))
);
-- The project's list (newest first) and the runner's queue (oldest open request first).
CREATE INDEX data_deletions_project_idx ON data_deletions (project_id, created_at DESC);
CREATE INDEX data_deletions_open_idx ON data_deletions (created_at)
  WHERE status IN ('pending', 'running');
