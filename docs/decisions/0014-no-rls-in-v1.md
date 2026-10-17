# 0014 — Tenant isolation in the application, not PostgreSQL RLS (v1)

- Status: Accepted (locked by spec §11)
- Date: 2026-10-17

## Decision
One guard builds an `AccessScope`; every tenant repository method requires it. A route-coverage test and a
two-organization isolation suite enforce it.

## Consequences
Simpler Prisma usage (no per-request `SET LOCAL` inside transactions). Trigger to add RLS as defense in depth:
any cross-tenant defect, or more than two developers writing data-access code (spec §20).
