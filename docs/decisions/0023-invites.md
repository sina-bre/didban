# 0023 — Invites

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §11: no public signup; users join through single-use invite tokens (≥ 256-bit, stored
hashed, 72 h). Owners and admins invite (admins cannot grant owner); platform admins create an
organization's first owner invite. There is no email infrastructure in v1.

## Decision
- **Token:** 32 random bytes (base64url), only SHA-256 stored, single use, 72 h. The API returns
  the link once: `PUBLIC_ORIGIN/accept-invite#<token>`. The **fragment** never reaches servers,
  logs or `Referer`; the dashboard reads it and POSTs it. The inviter shares the link themselves.
- **Who invites what:** owners any role; admins `member` only (the stricter reading of "cannot
  grant owner": an admin cannot create a peer either). Same rule for revoking. The role is
  re-read under the organization row lock. Platform admins: `owner` invites for live orgs only.
- **One open invite per (organization, email)** (partial unique index); a new one revokes the
  old one. Max 100 open invites per organization. Current members get 409.
- **Accepting** (`POST /auth/accept-invite`, public): new email → the password must pass the
  policy and becomes the account's password; **existing account → its current password is
  required** (login rate limits apply), so a forwarded link cannot attach someone's account to
  another organization. Success signs the user in (session rotation, as login).
  `POST /auth/accept-invite/preview` tells the form which case applies and the organization name.
- **No oracle:** unknown, used, revoked, expired or suspended-org tokens all get `400 INVITE_INVALID`.
- **Concurrency:** Argon2 runs before the transaction (no lock held for ~33 ms); the transaction
  re-reads the invite `FOR UPDATE`, so two parallel accepts give exactly one success.
- Audit: `invite.created`, `invite.revoked`, `invite.accepted`, plus the login rows.

## Consequences
The inviter must deliver the link (chat, email client). Old invite rows stay as history until the
purge job (Stage 6). Revisit when email delivery exists (send the link instead of showing it).
