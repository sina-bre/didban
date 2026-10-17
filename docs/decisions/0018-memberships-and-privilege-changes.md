# 0018 — Memberships, last-owner locking and privilege-change rotation

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §11 requires the last-owner rule, "rotate the session ID on privilege change", and project
members who must belong to the project's organization (§9.1). Stage 2b builds these before the
`AccessScope` guard (2c) and before project creation (2d).

## Decision
- **Locking:** every membership or project-member change first runs `SELECT … FROM organizations
  WHERE id = $1 FOR UPDATE` (`org-lock.ts`). Changes in one organization are serialized, so two owners
  demoting each other at the same time leave exactly one owner (tested).
- **Rotation:** we cannot set a new cookie for a user who is not making the request, so a change of
  org role or of `is_platform_admin` **revokes all of that user's sessions**, and the next login issues
  a fresh ID. Project-member grants do not revoke sessions: they are access-list entries that the
  per-request `AccessScope` reads anyway, so they take effect at once without new risk.
- **Removal:** removing a member deletes their `project_members` rows in that organization first
  (foreign keys stay `RESTRICT`), then the membership. The account and other memberships stay.
- **Projects:** migration 0003 creates `projects` with identity columns only. The settings columns
  (§9.1) arrive in 2d with the create-project use case, which defines their defaults.
- **Index** `project_members (user_id, organization_id)`: it serves the membership FK check and the
  AccessScope lookup. On 50 000 rows: index scan, 12 buffers, 0.03 ms; without it a sequential scan,
  569 buffers, 3.8 ms (`EXPLAIN (ANALYZE, BUFFERS)`, test DB, rolled back).

## Consequences
Promoting a user logs them out once. That is acceptable for a rare admin action. Revisit if roles
change often enough to annoy users; the alternative is a per-session `privileges_version` column.
