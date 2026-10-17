-- Spec §11 invites: single-use, 72 h, only SHA-256 of the 256-bit token is stored (ADR 0023).
-- Rows are kept after acceptance/revocation as history; the purge job (Stage 6) removes old ones.

CREATE TABLE invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  email            text NOT NULL CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  role             text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  token_hash       bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  -- NULL when a platform admin's CLI or a deleted path created it; no FK so history survives.
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  accepted_at      timestamptz,
  accepted_user_id uuid REFERENCES users (id) ON DELETE RESTRICT,
  revoked_at       timestamptz,
  CHECK (expires_at > created_at),
  CHECK ((accepted_at IS NULL) = (accepted_user_id IS NULL)),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);

-- At most one open invite per email and organization; a new invite revokes the old one first.
-- Also serves "pending invites of an organization".
CREATE UNIQUE INDEX invites_open_email_idx ON invites (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
