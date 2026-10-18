# Browser SDK (`@didban/analytics`)

Core API and behaviour (Stage 3d), optional modules, `notFound()`, the script-tag build and the
ingestion proxy (Stage 3e). Framework setup (React, Next.js, Vite, CSP, server events) is in
[`integration.md`](integration.md).

```ts
import { createAnalytics } from "@didban/analytics";

const analytics = createAnalytics({
  endpoint: "https://analytics.example.com", // or a same-origin proxy path such as "/a/e"
  writeKey: import.meta.env.VITE_ANALYTICS_WRITE_KEY,
});
analytics.track("signup_completed", { method: "email" });
```

`notFound(analytics)` (feature catalog §23.1) sends `page_not_found` with the `path` (no query
string). Call it from your 404 page; the SDK never sees HTTP status codes.

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

## Optional modules
Each module is its own entry point (≤ 1 KB gzipped, see `size-limit` in `packages/sdk`). Pass its
factory as the `autoCapture` value; a module you do not import adds zero bytes.

```ts
import { createAnalytics } from "@didban/analytics";
import { engagedTime } from "@didban/analytics/engaged-time";
import { fileDownloads } from "@didban/analytics/file-downloads";
import { outboundLinks } from "@didban/analytics/outbound-links";
import { scrollDepth } from "@didban/analytics/scroll-depth";

createAnalytics({
  endpoint: "/a/e",
  writeKey: "…",
  autoCapture: {
    outboundLinks: outboundLinks(),
    fileDownloads: fileDownloads({ extensions: ["pdf", "zip"] }), // default: a common list
    scrollDepth: scrollDepth(),
    engagedTime: engagedTime(),
  },
});
```

| Module | Event | Properties | When |
|---|---|---|---|
| `outbound-links` | `outbound_click` | `url` | left/middle click on a link to another host |
| `file-downloads` | `file_download` | `url` | link with `download` or a listed extension |
| `scroll-depth` | `scroll_depth` | `percent` (25/50/75/100) | each threshold once per page view, on scroll |
| `engaged-time` | `engaged_time` | `seconds` | leaving the page or hiding the tab; counts visible + focused time |

`url` is origin + path only (no query string or fragment, ≤ 255 chars). Link text and other DOM
content are never read. Click listeners are passive and in the capture phase (they never delay
or cancel a navigation). Scroll is measured at most once per animation frame. A link that is both
outbound and a download sends both events when both modules are on.

## Script tag
`dist/didban.iife.js` (core + all modules, ≤ 6.5 KB gzipped) reads its settings from data
attributes, so it needs no inline script and works under `script-src 'self'`. It exposes
`window.analytics` (the instance plus `notFound(path?)`).

```html
<script defer src="/js/didban.iife.js"
  integrity="sha384-…" crossorigin="anonymous"
  data-endpoint="/a/e" data-write-key="wk_…"
  data-modules="outbound-links file-downloads scroll-depth engaged-time"></script>
```

Other attributes: `data-identity="persistent"`, `data-require-consent="true"`,
`data-track-localhost="true"`, `data-spa="history|hash|off"`, `data-pageviews="false"`,
`data-exclude-paths="/admin/** /preview/*"`, `data-host-allowlist="shop.example"`,
`data-debug="true"`. Self-host the file (copy it from `node_modules/@didban/analytics/dist/`) and
pin it with Subresource Integrity; compute the hash for the exact file you serve:

```bash
openssl dgst -sha384 -binary didban.iife.js | openssl base64 -A
```

`examples/script-tag/serve.mjs` computes it at start-up and serves the page with a strict CSP.

## Same-origin proxy (ad blockers)
Ad blockers match well-known analytics hosts and paths. Serve ingestion from the tracked site
itself: `endpoint: "/a/e"` makes the SDK post to `/a/e/api/v1/ingest/batch`, and the site's
reverse proxy forwards `/a/e/*` to the collector with the `/a/e` prefix removed. This path is
for ingestion only; the dashboard never runs on a tracked site.

The proxy must pass the visitor's IP in `X-Forwarded-For`, and the collector's `TRUST_PROXY`
must count the proxies between the visitor and the collector (ADR 0026). If it does not, every
visitor appears to come from the proxy: geo is wrong and visitor hashing collapses, silently.

Caddy (sets `X-Forwarded-For` to the client address by default):

```caddy
shop.example {
	handle_path /a/e/* {
		reverse_proxy https://collector.example {
			header_up Host {upstream_hostport}
		}
	}
	# … the site itself
}
```

Nginx:

```nginx
location /a/e/ {
    proxy_pass https://collector.example/;   # trailing slash strips /a/e/
    proxy_set_header Host collector.example;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_ssl_server_name on;
}
```

With one proxy hop in front of the collector, set `TRUST_PROXY=1` there. If the collector is
itself behind its own Caddy, that is one more hop (`TRUST_PROXY=2`). Next.js rewrites do not add
`X-Forwarded-For`: see [`integration.md`](integration.md#nextjs-app-router).

Honest limits: some visitors still block the request (strict blockers, privacy browsers,
corporate filters). The dashboard undercounts them; no SDK trick changes that.
