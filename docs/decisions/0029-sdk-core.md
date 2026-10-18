# 0029 — SDK core: build, constants, delivery and page-view rules

- Status: Accepted
- Date: 2026-10-18

## Context
Stage 3d builds `@didban/analytics` core (spec §8.1–8.3, §8.6, addendum A2). A few points the spec
leaves open needed a choice, and the 5 KB gzipped budget forced one change to ADR 0010.

## Decision
- **Build:** tsdown 0.23 (Rolldown), ESM + `.d.ts` + source maps, `platform: browser`, `es2020`.
  size-limit 14 measures **gzip** (the spec says gzipped; size-limit defaults to brotli). Core
  is 4.89 kB of 5 kB. The script-tag IIFE build lands in 3e with its example.
- **Constants (amends ADR 0010):** the SDK copies the 9 values it needs into `src/limits.ts`
  instead of importing contracts' `LIMITS`/`INGEST_ERRORS` objects (inlining whole objects cost
  ~200 B gz and broke the budget). `contract.test.ts` asserts every copy equals contracts. Retry
  rule: the HTTP status decides (408/429/5xx retry), except `QUOTA_EXCEEDED`. A test checks this
  against every code in `INGEST_ERRORS`.
- **Endpoint:** `endpoint` is a base (origin or same-origin path); the SDK appends
  `/api/v1/ingest/batch`. A proxy forwards `/a/e/*` to the collector.
- **Delivery:** one send at a time; full jitter `random * min(30 s, 1 s * 2^attempt)`;
  `Retry-After` honoured up to 60 s, longer drops the batch. `keepalive` only under 60 KB (the
  browser rejects larger keepalive bodies). The batch waiting for a retry also goes into the
  page-hide beacon (duplicates are deduplicated by `eventId` on the server).
- **Consent:** in memory only; the site's consent tool calls `setConsent` on each load. Opt-out
  (`optOut()`, `?no_track=1`) is stored in localStorage in both identity modes.
- **Page views:** `spa: "auto"` patches History and counts the fragment only when it looks like
  a route (`#/…`, `#!/…`). Navigations coalesce through one `setTimeout(0)`. SPA views send the
  previous page URL as referrer (the server drops self-referrals). `excludePaths` skips page
  views only; custom events on those paths are still sent.
- **Start:** `createAnalytics` reads nothing from the page; checks, listeners and the first page
  view run on idle. `shutdown()` before that drops queued events (no StrictMode double count).

## Consequences
Two copies of 9 constants, guarded by a test. Only ~110 B of budget is left: 3e modules must be
separate entry points and anything new in core needs a size check first. Revisit the copy if
contracts ever exposes constants that tree-shake one by one.
