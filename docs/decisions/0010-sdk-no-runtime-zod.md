# 0010 — The SDK does not ship Zod; contracts are checked by tests

- Status: Accepted
- Date: 2026-10-17

## Context
Spec §2 says types are inferred from Zod in `packages/contracts`. But Zod adds several KB to a bundle with a
5 KB budget (§8.3), and a published `.d.ts` that imports a private workspace package is broken for npm users.

## Decision
- `packages/contracts` stays the single source of truth for the API and dashboard.
- The SDK declares its own small public types. It imports only **constants** (limits, error codes) from
  contracts, inlined at build time.
- `packages/sdk/test/contract.test.ts` parses real SDK payloads with the contracts schemas. A type test
  (`expectTypeOf`) asserts the SDK types are assignable to the inferred contract types. Drift fails CI.

## Consequences
Two type declarations to keep in sync, guarded by tests. The bundle stays dependency-free.
