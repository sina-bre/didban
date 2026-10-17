-- Spec §9.1: projects (identity columns only; settings columns arrive with project creation in 2d)
-- and project_members. A project member must be a member of the project's organization: both
-- composite foreign keys go through organization_id, so a row for an outsider cannot exist.

CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  slug            text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug),
  -- Target of the composite foreign key from project_members.
  UNIQUE (id, organization_id)
);

CREATE TABLE project_members (
  project_id      uuid NOT NULL,
  organization_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  role            text NOT NULL CHECK (role IN ('project_admin', 'viewer')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, organization_id) REFERENCES memberships (user_id, organization_id) ON DELETE RESTRICT
);

-- Serves the membership foreign key (RESTRICT check on member removal) and
-- "which projects can this user reach in this organization" (AccessScope, 2c).
CREATE INDEX project_members_user_org_idx ON project_members (user_id, organization_id);
