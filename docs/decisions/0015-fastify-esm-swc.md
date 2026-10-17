# 0015 — API on Fastify, ESM, compiled with SWC

- Status: Accepted
- Date: 2026-10-17

## Context
NestJS 12.1 ships as ESM only (`"type": "module"`). Ingestion must reject bodies over 128 KB on the stream
(spec §7.1) and accept `text/plain` JSON from `sendBeacon`. Performance matters (addendum A2).

## Decision
- `@nestjs/platform-fastify` (Fastify 5.12): faster than Express for small JSON requests, built-in Pino
  logging, and `bodyLimit` enforced while streaming (413 before parse, verified live in Stage 1c).
- The API package is ESM (`NodeNext`, `.js` import suffixes).
- SWC compiles (`swc src -d dist`), because Nest DI needs decorator metadata that esbuild/tsx do not emit.
  `tsc` only typechecks. Vitest uses `unplugin-swc` with `swcrc: false`.
- Biome's `useImportType` is **off for `apps/api`**: turning a constructor-injected class import into
  `import type` silently breaks Nest DI at runtime.
- `trustProxy` hop counts are passed as the predicate `(addr, hop) => hop < n` (what Fastify does internally;
  its types do not accept numbers).

## Consequences
No `@nestjs/cli` dependency; `pnpm dev` is a 20-line script (SWC watch + `node --watch`). Express-only Nest
middleware cannot be used; use Fastify plugins/hooks instead.
