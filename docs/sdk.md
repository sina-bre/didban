# Browser SDK (`@didban/analytics`)

Core API and behaviour as built in Stage 3d. Proxy snippets, the script-tag build, optional
modules and the React adapter are added in Stage 3e.

```ts
import { createAnalytics } from "@didban/analytics";

const analytics = createAnalytics({
  endpoint: "https://analytics.example.com", // or a same-origin proxy path such as "/a/e"
  writeKey: import.meta.env.VITE_ANALYTICS_WRITE_KEY,
});
analytics.track("signup_completed", { method: "email" });
```

Methods: `page`, `track`, `identify`, `reset`, `setConsent("granted" | "denied")`, `optOut`,
`optIn`, `flush` (a promise), `shutdown`. None of them throw. Failures go to `onError(err)`, and
`err.code` is one of: a server code (`ORIGIN_NOT_ALLOWED`, `RATE_LIMITED`, … see spec §6.5),
`HTTP_<status>`, `QUEUE_OVERFLOW`, `RETRIES_EXHAUSTED`, `PAYLOAD_TOO_LARGE`, `EVENTS_REJECTED`,
`BEFORE_SEND_FAILED`, `INVALID_ARGUMENT`, `INVALID_OPTIONS`, `INTERNAL`.

## Behaviour
- Requests go to `<endpoint>/api/v1/ingest/batch` as `text/plain` JSON with the write key in
  the body (no CORS preflight). Cookies are never sent.
- Nothing is read from the page and nothing is sent until the browser is idle.
- One instance per `(endpoint, writeKey)`: calling `createAnalytics` again returns it.
- On the server (no `window`) every method is a no-op.
- Not tracked: `file://` pages, iframes whose parent is on another origin, localhost (unless
  `trackLocalhost`), hosts outside `hostAllowlist`, Global Privacy Control, Do Not Track, opted-out
  browsers (`optOut()` or visiting any page with `?no_track=1`), and `setConsent("denied")`.
- `requireConsent: true` holds events in memory (bounded by `maxQueueSize`) until consent.
- `identity: "cookieless"` (default) stores nothing and sends no stable ID. `"persistent"` keeps
  one `anonymousId` in localStorage, shared by all tabs; `reset()` replaces it.
- Page views: the first load (after prerender activation), each real URL change in a single-page
  app, and bfcache restores. The URL is path + query; the fragment counts in `spa: "hash"` mode, or
  in `"auto"` mode when it looks like a route (`#/inbox`).

## Delivery semantics
At-least-once with best-effort delivery. The in-memory queue is lost on tab close if the final
beacon fails. Retries can duplicate events; the server deduplicates by `(project_id, event_id)`
for as long as the event row exists. No exactly-once claim. Persistent/offline queues are out
of scope for v1.

Retries: network errors, timeouts, 408, 429, 5xx, up to `maxRetries` (4) with full-jitter
backoff (1 s base, 30 s cap). `Retry-After` is honoured up to 60 s. A 413 halves the batch once,
then drops. Other errors drop the batch. When the page is hidden, queued events go out with
`navigator.sendBeacon` in chunks under 60 KB.
