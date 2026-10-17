-- Spec §11: server-side sessions. Only SHA-256(token) is stored; the token lives in the cookie.
-- Idle timeout is checked against last_seen_at; expires_at is the absolute lifetime.

CREATE TABLE auth_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ua_label     text NOT NULL CHECK (char_length(ua_label) <= 64),
  ip_prefix    text NOT NULL CHECK (char_length(ip_prefix) <= 64)
);

-- "Log out everywhere" and password change delete by user.
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
