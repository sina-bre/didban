-- Spec §9.1: organizations, users, memberships. UUID keys, RESTRICT deletes, CHECK caps on text.

CREATE TABLE organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  suspended_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  password_hash     text NOT NULL CHECK (char_length(password_hash) <= 255),
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

-- Listing members of an organization; the PK already serves lookups by user.
CREATE INDEX memberships_organization_idx ON memberships (organization_id);
