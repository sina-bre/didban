-- Spec §7 step 6 + §9.1 + §23.1: settings read by enrichment, and route templates (ADR 0026).

ALTER TABLE projects
  -- Keep the URL hash as part of the path (hash-routed single-page apps).
  ADD COLUMN hash_routing       boolean NOT NULL DEFAULT false,
  -- City is stored only when the project opts in (spec §7: country/region otherwise).
  ADD COLUMN store_city         boolean NOT NULL DEFAULT false,
  -- Site search (§23.1): query parameters whose value becomes `search_term` on page views.
  ADD COLUMN site_search_params text[]  NOT NULL DEFAULT '{}' CHECK (cardinality(site_search_params) <= 3);

-- `:param` matches one segment, a trailing `*` the rest; never raw regex (ReDoS). The position
-- range plus the primary key caps a project at 200 templates. The PK also serves "templates of a
-- project in order" for the write-key lookup and the projects foreign key.
CREATE TABLE route_templates (
  project_id uuid        NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  position   integer     NOT NULL CHECK (position BETWEEN 1 AND 200),
  pattern    text        NOT NULL CHECK (char_length(pattern) BETWEEN 1 AND 200 AND pattern LIKE '/%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, position),
  UNIQUE (project_id, pattern)
);
