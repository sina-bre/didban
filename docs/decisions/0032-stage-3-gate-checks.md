# 0032 — Stage 3 gate checks run end to end

- Status: Accepted
- Date: 2026-10-18

## Context
Spec §18 Stage 3 gate: both examples' events land in PostgreSQL (one page view per Next.js
navigation), a server event with `$revenue`/`$currency` lands, the real client IP reaches the
collector through the proxy, SDK + retry tests green, load baseline recorded; phases.md adds
publint/attw/tarball install. Until 3f the e2e examples talked to a recording stand-in only.

## Decision
- `pnpm test:e2e` starts the **built API on the local test DB**, seeded by `e2e/seed-e2e.mjs`
  (truncates, refuses non-local hosts) with fixed test-only keys. `e2e/collector.mjs` stays as a
  recording hop (proxy headers) but forwards every batch to the API and returns its answer.
  Specs assert committed rows; `server-event.spec.ts` covers revenue + retry-as-duplicate.
- The e2e browser sends a desktop Chrome user agent: "HeadlessChrome" is a bot to the API (correct).
- Host-site perf (A2, 5 ms): trace only `devtools.timeline` (the `v8` category slowed the traced
  code) and assert the **median of three** fresh loads; all three are logged.
- `pnpm check:packages`: publint `--strict`, attw (`esm-only` profile), `pnpm pack`, npm install
  of both tarballs into an empty temp project with `--ignore-scripts`, smoke import in Node.

## Consequences
E2E now needs PostgreSQL and `pnpm build` first, and it empties the test DB. The SDK start
task is 2.2–5.3 ms on the reference box: the 5 ms budget has little margin. Splitting the idle
start into steps is the fix if the median ever fails (needs core bytes; ~30 B left).
