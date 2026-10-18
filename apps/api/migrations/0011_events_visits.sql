-- Spec §4 + §7 steps 7–8 + §9.1–9.3: identity salts, events, visits and discovered pages (ADR 0028).

-- Cookieless identity: one random salt per UTC day, shared by every API process. Rows older than
-- yesterday are deleted when a new day's salt is created, so old visitor IDs cannot be recomputed.
CREATE TABLE daily_salts (
  day        date        PRIMARY KEY,
  salt       bytea       NOT NULL CHECK (octet_length(salt) = 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  project_id      uuid          NOT NULL,
  environment_id  uuid          NOT NULL,
  event_id        uuid          NOT NULL,
  type            smallint      NOT NULL CHECK (type IN (1, 2, 3)),
  occurred_at     timestamptz   NOT NULL,
  received_at     timestamptz   NOT NULL,
  visitor_id      bytea         NOT NULL CHECK (octet_length(visitor_id) = 16),
  source          smallint      NOT NULL CHECK (source IN (1, 2)),
  visit_id        uuid,
  user_id         text          CHECK (char_length(user_id) <= 128),
  name            text          CHECK (char_length(name) <= 64),
  hostname        text          NOT NULL CHECK (char_length(hostname) <= 253),
  pathname        text          NOT NULL CHECK (char_length(pathname) <= 2048),
  route           text          NOT NULL CHECK (char_length(route) <= 2048),
  revenue         numeric(14,2),
  currency        char(3),
  referrer_host   text          CHECK (char_length(referrer_host) <= 253),
  referrer_source text          CHECK (char_length(referrer_source) <= 100),
  channel         smallint      NOT NULL CHECK (channel BETWEEN 0 AND 5),
  utm_source      text          CHECK (char_length(utm_source) <= 255),
  utm_medium      text          CHECK (char_length(utm_medium) <= 255),
  utm_campaign    text          CHECK (char_length(utm_campaign) <= 255),
  utm_term        text          CHECK (char_length(utm_term) <= 255),
  utm_content     text          CHECK (char_length(utm_content) <= 255),
  country         char(2),
  region          text          CHECK (char_length(region) <= 100),
  city            text          CHECK (char_length(city) <= 100),
  browser         text          CHECK (char_length(browser) <= 50),
  browser_major   smallint,
  os              text          CHECK (char_length(os) <= 50),
  device_type     smallint      CHECK (device_type BETWEEN 1 AND 4),
  screen_class    smallint      CHECK (screen_class BETWEEN 1 AND 4),
  language        text          CHECK (char_length(language) <= 35),
  properties      jsonb         NOT NULL DEFAULT '{}'
                  CHECK (jsonb_typeof(properties) = 'object' AND pg_column_size(properties) <= 8192),
  PRIMARY KEY (project_id, event_id),
  CHECK ((revenue IS NULL) = (currency IS NULL)),
  CHECK (source = 1 OR visit_id IS NULL),
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);
-- Base range scans per environment; event reports by name (spec §9.2, the only secondary indexes).
CREATE INDEX events_range_idx ON events (project_id, environment_id, occurred_at DESC);
CREATE INDEX events_name_idx ON events (project_id, name, occurred_at DESC) WHERE type = 2;

-- Browser events only: server events create no visit (spec §6.2). Entry/exit stay NULL for a
-- visit that has no page event yet.
CREATE TABLE visits (
  project_id      uuid        NOT NULL,
  visit_id        uuid        NOT NULL,
  environment_id  uuid        NOT NULL,
  visitor_id      bytea       NOT NULL CHECK (octet_length(visitor_id) = 16),
  started_at      timestamptz NOT NULL,
  last_seen_at    timestamptz NOT NULL CHECK (last_seen_at >= started_at),
  entry_pathname  text        CHECK (char_length(entry_pathname) <= 2048),
  exit_pathname   text        CHECK (char_length(exit_pathname) <= 2048),
  pageviews       integer     NOT NULL CHECK (pageviews >= 0),
  events          integer     NOT NULL CHECK (events > 0),
  referrer_source text        CHECK (char_length(referrer_source) <= 100),
  channel         smallint    NOT NULL CHECK (channel BETWEEN 0 AND 5),
  utm_source      text        CHECK (char_length(utm_source) <= 255),
  utm_medium      text        CHECK (char_length(utm_medium) <= 255),
  utm_campaign    text        CHECK (char_length(utm_campaign) <= 255),
  utm_term        text        CHECK (char_length(utm_term) <= 255),
  utm_content     text        CHECK (char_length(utm_content) <= 255),
  country         char(2),
  browser         text        CHECK (char_length(browser) <= 50),
  os              text        CHECK (char_length(os) <= 50),
  device_type     smallint    CHECK (device_type BETWEEN 1 AND 4),
  engaged_ms      integer     CHECK (engaged_ms >= 0),
  PRIMARY KEY (project_id, visit_id),
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);
CREATE INDEX visits_visitor_idx ON visits (project_id, visitor_id, last_seen_at DESC);
CREATE INDEX visits_started_idx ON visits (project_id, started_at DESC);

-- "Discovered pages". Capped at 10 000 rows per project in the writer; past the cap new routes
-- land on the literal route '/__other__'. The PK prefix serves the per-project count.
CREATE TABLE pages_seen (
  project_id     uuid        NOT NULL,
  environment_id uuid        NOT NULL,
  hostname       text        NOT NULL CHECK (char_length(hostname) <= 253),
  route          text        NOT NULL CHECK (char_length(route) <= 2048),
  first_seen_at  timestamptz NOT NULL,
  last_seen_at   timestamptz NOT NULL CHECK (last_seen_at >= first_seen_at),
  last_title     text        CHECK (char_length(last_title) <= 300),
  PRIMARY KEY (project_id, environment_id, hostname, route),
  FOREIGN KEY (environment_id, project_id) REFERENCES environments (id, project_id) ON DELETE RESTRICT
);
