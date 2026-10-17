-- ADR 0024 (owner decision): no invites. Owners/admins create users with a one-time temporary
-- password; the user must set their own before anything else works. 0006 stays (forward-only).

DROP TABLE invites;

ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
