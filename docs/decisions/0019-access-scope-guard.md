# 0019 — One guard, a per-request AccessScope and the `@Requires` decorator

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §11 asks for one guard that resolves the principal and builds an `AccessScope`, one decorator
per route declaring the permission, 404 for anything the principal cannot see (403 only for
visible resources), and a route-coverage test. Suspended organizations must vanish (ADR 0018 note).

## Decision
- **One guard:** the existing global `SessionGuard` resolves the session, then calls `authorize()`
  (`modules/access/authorize.ts`), which loads the scope and applies the route's permission.
  Two queries per request, run in parallel: the caller's memberships, and the projects they reach
  (org owner/admin: every live project; member: only `project_members` rows). Suspended orgs and
  archived projects are left out. No cache (spec §20: no caches until measured).
- **Rules are pure:** `domain/permissions.ts` `decide(scope, permission, target)` returns
  `allow | not_found | forbidden`. Permissions: `self`, `platform`, `org:roles`, `org:projects`,
  `project:view`, `project:manage`, `project:members`. The target comes from route params by
  convention: `:organizationId` for `org:*`, `:projectId` for `project:*`.
- **Fail closed:** a non-public route without `@Requires` throws (500) at runtime, and the
  route-coverage test (Nest `DiscoveryService`) fails the build. Public routes must equal an
  explicit allowlist (now: health live/ready, login).
- **Malformed IDs** in params are 404 (`UuidPipe`), never a 400 or a Postgres error.
- **Platform admin** routes answer 403 to non-admins: the admin area itself is not a secret.
- 2b use cases keep their own check inside the org-row lock (race safety, ADR 0018); the guard
  is the first gate, the use case the second.

## Consequences
Every new route needs one line (`@Requires(...)`), and tenant queries read IDs from the scope.
The scope is rebuilt per request, so role and suspension changes apply at once. Revisit (cache or
per-route lazy loading) if the scope queries show up in latency measurements or an org grows
past a few hundred projects.
