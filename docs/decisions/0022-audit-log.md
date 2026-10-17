# 0022 — Append-only audit log

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §11: append-only audit log of security and configuration changes with actor, action,
target, request ID, truncated IP and time; never secrets; org owners/admins can read it.

## Decision
- **Table `audit_logs`** (migration 0005): `bigint` identity key (ordered, small), no foreign keys
  on actor/target/project so rows outlive what they mention. `organization_id` is `NULL` for
  account events (login, logout, password) and instance events (platform admin flag).
- **Append-only, enforced twice:** the app role loses `UPDATE, DELETE, TRUNCATE`, and a trigger
  refuses `UPDATE`/`DELETE` from anyone, the owner included. No code path changes rows.
- **Same transaction:** `recordAudit(tx, ...)` runs inside the transaction that makes the change,
  so a rolled-back change leaves no row and a change cannot commit without its row.
  Login rows are written on their own (there is no transaction to join).
- **Context:** request ID and client IP (stored truncated, /24 or /48) come from an
  `AsyncLocalStorage` set by the first `onRequest` hook, like a logger's correlation ID. The actor
  is always passed explicitly. CLI actions have no actor and no request metadata.
- **No secrets:** `details` holds enum values only (roles, key kind, the generated key prefix) and
  the *names* of changed fields, never typed values. Failed logins never store the typed email
  (people paste passwords into it); they reference the user only when the account exists.
- **Repeats are not logged twice:** revoking an already revoked key adds no row.
- **Reading:** `GET /organizations/:organizationId/audit-log?limit=&before=` (`org:audit`: owner,
  admin), newest first, keyset pagination on `id`, max 100 per page. Account-level rows have no
  reader yet (a "my security activity" page can come later).

## Consequences
Every new security-relevant use case adds one `recordAudit` call in its transaction; new actions
go into `AUDIT_ACTIONS` (contracts) without a migration. The table grows with failed logins;
the login limiter bounds the rate, and a retention rule is decided with the purge job (Stage 6).
Index `audit_logs (organization_id, id DESC) WHERE organization_id IS NOT NULL`: 150 000 rows,
generic plan, first page 73 buffers via the index vs. a backward PK scan discarding 52 464 rows.
The cursor is written `id < coalesce-bound` (not `$x IS NULL OR ...`) so it stays in the Index
Cond: a deep page reads 26 buffers.
