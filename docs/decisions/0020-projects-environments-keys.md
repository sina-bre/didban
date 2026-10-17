# 0020 — Project settings, environments and write keys

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §9.1 lists the project and environment columns and the `api_keys` shape, §11 the permission
table, §13 an integration page that "shows the real write key". Some value ranges are not given.

## Decision
- **Routes.** Create/list/archive go through the organization (`org:projects`):
  `GET|POST /organizations/:organizationId/projects`, `PATCH .../:projectId {archived}` (the SQL also
  matches `organization_id`, so another org's project ID is 404). Settings: `GET /projects/:projectId`
  (`project:view`), `PATCH` (`project:manage`, project admins included). Environments: list
  `project:view` (dashboard filter), create/update `project:manage`. Keys: all `project:manage`.
  No environment or key deletion: keys are revoked, never deleted.
- **Second gate.** Use cases take the `AccessScope` and read IDs through `projectInScope` /
  `organizationInScope` (`modules/access/in-scope.ts`); child rows are matched on `project_id` too.
- **Ranges we chose:** session timeout 5–120 min (§4), retention 7–3650 days or `NULL` = forever,
  `pii_guard` `strip|off`, `trailing_slash_policy` `strip|keep`, ≤ 20 URL params, ≤ 50 origins and
  CIDRs per environment, ≤ 10 active keys per environment, `allow_identify` default `false`.
- **Time zones:** IANA names or `UTC` only, checked with `Intl`. Offsets such as `+03:30` are refused:
  Postgres reads POSIX offsets with the opposite sign.
- **Origins** are exact `scheme://host[:port]`, normalized by `URL` (lower case, punycode, no
  trailing slash). No wildcards in v1. **CIDRs** are checked with `node:net`; bare IPs get `/32`/`/128`.
- **Key token** `dpk_|dsk_` + 12 hex (the 16-char shown prefix) + `_` + 32 random bytes base64url.
  Only SHA-256 of the whole token is stored, so the token is returned **once**, on creation.
  This overrides the §13 wording: the integration page shows the token right after creation,
  otherwise the prefix and a "create new key" action.

## Consequences
A lost browser key means creating a new one (cheap, max 10 active). Stage 3 resolves keys by
`secret_hash` (unique index). Audit rows for these actions land with the audit log (2d-2).
Revisit wildcard origins if owners ask for many subdomains.
Index `api_keys (project_id, environment_id)`: 20 000 keys, list by project and active-count per
environment go from Seq Scan (385 buffers) to index scans (12 buffers).
