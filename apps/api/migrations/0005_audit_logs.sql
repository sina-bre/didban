-- Spec §11 audit log: append-only, no secrets (ADR 0022). Rows outlive what they mention, so the
-- actor/target/project columns carry no foreign keys. organization_id is NULL for account-level
-- events (login, logout, password) and instance-level ones (platform admin flag).

CREATE TABLE audit_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid REFERENCES organizations (id) ON DELETE RESTRICT,
  project_id      uuid,
  actor_user_id   uuid,
  action          text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$' AND char_length(action) <= 64),
  target_type     text CHECK (target_type ~ '^[a-z_]{1,32}$'),
  target_id       uuid,
  details         jsonb NOT NULL DEFAULT '{}'
                  CHECK (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 2048),
  request_id      uuid,
  ip_prefix       text CHECK (char_length(ip_prefix) <= 64),
  CHECK ((target_type IS NULL) = (target_id IS NULL))
);

-- Org audit page: newest first, keyset pagination on id.
CREATE INDEX audit_logs_organization_idx ON audit_logs (organization_id, id DESC)
  WHERE organization_id IS NOT NULL;

-- Append-only, twice: the app role loses UPDATE/DELETE/TRUNCATE, and a trigger refuses row
-- changes from anyone (also the owner), so a bug or a stolen app credential cannot rewrite history.
CREATE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_logs_no_change BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM analytics_app;
  END IF;
END $$;
