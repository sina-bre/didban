-- Spec §3.1 goals (match an event name or a page path pattern; ≤ 50 per project, enforced in the
-- use case under a project row lock) and public share links (§11: one project, read-only, token
-- stored as SHA-256 only; catalog 23.3: revocable, optional expiry). ADR 0036.

CREATE TABLE goals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  kind         text        NOT NULL CHECK (kind IN ('event', 'page')),
  event_name   text        CHECK (char_length(event_name) <= 64),
  path_pattern text        CHECK (char_length(path_pattern) <= 200),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name),
  CHECK ((kind = 'event') = (event_name IS NOT NULL)),
  CHECK ((kind = 'page') = (path_pattern IS NOT NULL))
);

CREATE TABLE share_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  label       text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  token_hash  bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  revoked_at  timestamptz
);
-- Listing a project's links; the token lookup uses the UNIQUE index on token_hash.
CREATE INDEX share_links_project_idx ON share_links (project_id, created_at DESC);
