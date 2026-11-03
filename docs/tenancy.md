# Tenancy and authorization

One instance hosts many **organizations**; each owns **projects**; each project has
**environments** (e.g. production, staging) with their own write keys and allowed origins.
Isolation is enforced in the application (no row-level security in v1, ADR 0014).

## Roles
| Role | Scope | Can |
|---|---|---|
| Platform admin | Instance | Create/suspend organizations and their first owner, see instance health and usage counts. **No analytics or project data** unless also a member. |
| Owner | Organization | Everything in the organization: users of any role, password resets, projects, settings, keys, deletion, audit log. At least one owner always remains (`LAST_OWNER`). |
| Admin | Organization | Every project of the organization; create `member` users only. |
| Member | Assigned projects | `viewer` on a project: read its analytics; `project_admin`: also manage it and assign its members (`project_members`). |

The first owner of an instance comes from `pnpm cli create-owner`; platform admins from
`pnpm cli grant-platform-admin <email>` (and `revoke-platform-admin`); any password from `pnpm cli reset-password <email>` (ADR 0024).

## How it is enforced (ADR 0018, 0019)
- One global guard resolves the session and builds an `AccessScope` (memberships + reachable
  projects, suspended organizations and archived projects left out). Every route declares a
  permission (`self`, `platform`, `org:roles`, `org:users`, `org:projects`, `project:view`,
  `project:manage`, `project:members`) or is on the public allowlist; a route without one fails
  the route-coverage test and throws at runtime.
- `domain/permissions.ts` decides `allow | not_found | forbidden` from the scope alone. Anything
  outside your scope is **404 with the same body as a missing row**: IDs leak no existence.
- Every tenant query takes the scope; no repository method accepts a bare project ID. Role changes
  run under an organization row lock so concurrent changes cannot remove the last owner.
- Write keys belong to one environment and can only write; share tokens can only read the
  share-view reports of one project.

## Evidence
`apps/api/src/modules/access/*.test.ts`: route coverage, and a two-organization suite in which
owner B requests every one of owner A's routes with real IDs and gets 404 on all of them; members
see only assigned projects; a non-member platform admin sees no analytics; write keys read nothing.
