# 0051 — `pnpm audit` findings fixed with overrides

- Status: Accepted
- Date: 2026-11-02

## Context
Stage 6c `pnpm audit` (2026-11-02): 11 findings, 5 low and 6 moderate, none high or critical.

| Package | Found | Reached through | Advisory | Runtime? |
|---|---|---|---|---|
| fastify | 5.12.5 | API; `@nestjs/platform-fastify` pins it exactly | GHSA-389g-gv7q-r4x8 (low, header validation case) | yes |
| fast-uri | 3.x < 3.1.9, 4.x < 4.2.3 | fastify's ajv / fast-json-stringify; dashboard `@hookform/resolvers` → ajv | GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr (moderate), GHSA-xhq7-xmqj-769h, GHSA-333x-w4r6-6crp (low) | API yes (schema compiler); dashboard build only |
| uuid | 8.3.2 | `tools/load` → autocannon | GHSA-w5hq-g745-h8pq (moderate, v3/v5/v6 with a caller buffer) | no (load tool) |
| minimatch | 9.0.9 | `@swc/cli` (API build) | GHSA-g3hv-75wg-m249 (moderate, glob DoS) | no (build) |

Our code passes no untrusted URIs to fast-uri and no untrusted globs to minimatch, so the real
exposure was small; the patched versions are drop-in.

## Decision
Fix all of them; accept none. The API's own `fastify` goes to 5.12.6; `overrides` in
`pnpm-workspace.yaml` lift the copies that parents pin or have not updated (fastify for Nest,
fast-uri 3.1.9 / 4.2.3, uuid 11.1.1, minimatch 11.0.1). Versions published the same day were
avoided (minimatch 11.0.4 was a few hours old). After `pnpm install`: "No known vulnerabilities
found"; API build, tests, e2e and the load tool ran on the new tree.

## Consequences
- Overrides can mask a parent's real requirement: remove each one once the parent ships the fix
  (`@nestjs/platform-fastify` > 12.1.3, autocannon, `@swc/cli`). Check with `pnpm why <pkg>`.
- `pnpm audit` belongs to every stage gate from now on (DoD final report, Stage 6d).
