## 8. SDK (`packages/sdk`)

### 8.1 Public API

```ts
import { createAnalytics } from "@didban/analytics";

const analytics = createAnalytics({
  endpoint: "https://analytics.example.com",   // or a same-origin proxy path, see 8.4
  writeKey: import.meta.env.VITE_ANALYTICS_WRITE_KEY,
});

analytics.page();                               // normally automatic
analytics.track("signup_completed", { method: "email" });
analytics.identify("user_123");
analytics.reset();                              // clears identity + session state
analytics.setConsent("granted" | "denied");
analytics.optOut(); analytics.optIn();
await analytics.flush();
analytics.shutdown();                           // flush, remove listeners, restore history patches, clear timers
```

Package name is configurable. Do not publish, and do not use real credentials, without explicit human authorization.

### 8.2 Options (defaults)

| Option | Default |
|---|---|
| `identity` | `"cookieless"` (sends no stable ID) or `"persistent"` |
| `requireConsent` | `false`. When `true`, events queue in memory (bounded) until `setConsent("granted")`, and are dropped on `"denied"`. |
| `respectGlobalPrivacyControl` / `respectDoNotTrack` | `true` / `true` |
| `trackLocalhost` | `false` |
| `hostAllowlist` | none (track any non-localhost host) |
| `autoCapture.pageviews` | `true` |
| `autoCapture.spa` | `"auto"` (`"history" \| "hash" \| "off"`) |
| `autoCapture.outboundLinks / fileDownloads / scrollDepth / engagedTime` | `false` |
| `excludePaths` | `[]` (glob list) |
| `flushIntervalMs` | 5000 |
| `maxBatchSize` | 20 (≤ 50) |
| `maxQueueSize` | 200. Oldest dropped first and counted; exposed via `onError`/debug. |
| `requestTimeoutMs` | 8000 |
| `maxRetries` | 4. Exponential backoff with full jitter: base 1 s, cap 30 s. |
| `beforeSend(event)` | identity. Return `null` to drop. Exceptions are caught and the event is sent unmodified only if `failOpen: true`; default drops it. |
| `onError(err)` | no-op |
| `debug` | `false` |

### 8.3 Behavior requirements

- **Never throws, never blocks.** Every public method is wrapped. Failures go to `onError`. Tracking must not delay user interaction.
- **Singleton per `(endpoint, writeKey)`.** A second `createAnalytics` returns the existing instance and warns once.
- **SSR-safe:** importing or calling on the server touches no browser global and returns a no-op instance.
- **Transport:** `fetch` with `keepalive: true` and `AbortController` timeout. On `visibilitychange → hidden` and `pagehide`, flush via `navigator.sendBeacon` (`text/plain`, write key in body). Beacon payloads stay under 60 KB; split if needed.
- **SPA page views:** wrap `history.pushState/replaceState` (idempotent, chained with other libraries' patches, restored on `shutdown`), listen to `popstate`, `hashchange` in hash mode. Emit a page view only when the tracked URL (path + search, hash only in hash mode) actually changes. Ignore `replaceState` calls that change only state or hash. Coalesce multiple navigations in one task.
- **Lifecycle edge cases (each needs a test):**
  - Prerendered pages: do not count until `prerenderingchange`.
  - bfcache restore (`pageshow` with `persisted`): emit a new page view.
  - `file://` and iframes with an unreachable parent: no-op.
  - Storage unavailable (Safari private mode, blocked cookies): fall back to memory, never throw.
  - Multiple tabs: no shared mutable state in `cookieless` mode. In `persistent` mode, a single `anonymousId` is shared via storage.
- **`identify`:** sets `userId` on all later events from this instance and sends one `identify` event. It is a no-op unless the project allows it (server rejects `userId` otherwise and counts it).
- **Auto-capture modules are separate code paths.** Tree-shakeable; disabled modules cost zero bytes.
- **No automatic capture** of form values, input contents, or DOM text.
- **Size budget:** core ≤ 5 KB gzipped, each optional module ≤ 1 KB gzipped. Enforce with `size-limit`. A failing budget fails the build.

### 8.4 Real-world delivery: ad blockers and proxies

Ad blockers match well-known analytics hostnames and paths. Document and test the recommended setup:
- Serve the ingestion endpoint **same-origin on the customer's site** via their reverse proxy (`/a/e` → analytics host). The SDK `endpoint` accepts a relative path. This proxy path is for **ingestion only**; the dashboard never lives on a tracked site (section 14.0).
- For Next.js, document a `rewrites()` proxy and **verify in the example that the real client IP reaches the collector** (check the trusted-proxy hop count). If it does not, geo and visitor hashing degrade silently, so make this a test, not a note.
- Provide a Caddy and an Nginx snippet in `docs/sdk.md` for this proxy, forwarding `X-Forwarded-For` correctly so geo and visitor hashing see the real client IP.
- Do not name files or routes `analytics`, `track`, or `tracking` in the example configs.
- Document honestly: some traffic will still be blocked; the dashboard undercounts and no SDK trick changes that.

### 8.5 Builds and package metadata

- ESM + types + source maps for npm; IIFE minified build for `<script defer data-endpoint data-write-key …>` use (exposes `window.analytics`; works under a strict CSP with no inline script; ship a Subresource Integrity example).
- `package.json`: `type: "module"`, `exports` map, `types`, `sideEffects: false`, `files`, `engines`, `license`, `publishConfig`, `repository`. Validate with `npm pack --dry-run`, `publint`, and `@arethetypeswrong/cli`.
- Independent of React, NestJS, and the dashboard. A fresh `npm install` of the packed tarball in an empty project must work.

### 8.6 Delivery semantics (state these exactly in `docs/sdk.md`)

At-least-once with best-effort delivery. The in-memory queue is lost on tab close if the final beacon fails. Retries can duplicate events; the server deduplicates by `(project_id, event_id)` for as long as the event row exists. No exactly-once claim. Persistent/offline queues are out of scope for v1.

### 8.7 SDK tests (Vitest + jsdom, fake timers)

Serialization; batching by size and interval; flush; backoff math and jitter bounds; retry limit; non-retryable codes; `Retry-After`; 413 split; queue overflow; consent pending/granted/denied; GPC/DNT; storage failure; SSR import; duplicate init; SPA navigation without double-count; prerender; bfcache; shutdown cleanup (no leaked listeners or timers); `beforeSend` throwing; contract test posting SDK output against the real `packages/contracts` schemas.

### 8.8 Host-site integration (React / Next.js) and the React adapter

Document in `docs/integration.md` and prove in `examples/nextjs-app-router` and `examples/vanilla-vite`:
- **Initialize once, client-side only.** In Next.js App Router, use a `'use client'` module or provider. The per-`(endpoint, writeKey)` singleton absorbs React StrictMode double effects and HMR re-runs. Test both.
- **Page views need no router-specific code.** The History API handling covers Next.js `<Link>` and `router.push/replace`. The example must exercise both, and a test must assert exactly one page view per navigation.
- **The write key is public.** Use `NEXT_PUBLIC_*` / `VITE_*` variables; server keys never get a public prefix. One key per environment (`production`, `staging`), selected by the deployment's env file.
- **Host-site CSP:** `connect-src` must allow the collector origin (not needed when using the same-origin proxy path). The script-tag build also needs `script-src` for the host serving it, or a self-hosted copy with SRI.
- **`@didban/react`:** `AnalyticsProvider`, `useAnalytics()`; `react` as a peer dependency; ≤ 1 KB gzipped; tested with React Testing Library; no logic beyond wiring the core instance.
- **Server events:** `docs/integration.md` includes a complete `fetch` example for reporting `purchase_completed` with `$revenue`/`$currency` and `userId` from a server handler using a `write_server` key, with the warning that the key must never reach a frontend bundle.
