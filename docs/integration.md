# Integrating didban into a site

How to add the browser SDK to React, Next.js, Vite and plain HTML sites, and how to send
server-side events. SDK reference: [`sdk.md`](sdk.md). Working code: `examples/`, checked by the
Playwright suite in `e2e/` (`pnpm test:e2e`).

## Keys and environments
- The **browser write key is public**: it ships in your bundle. Read it from `VITE_*` or
  `NEXT_PUBLIC_*` variables. Create one key per environment (`production`, `staging`) and select
  it with the deployment's env file.
- A **`write_server` key is a secret**. Never give it a public prefix, never import it in code
  that reaches a browser bundle. A leaked server key can send events for any visitor.

## Initialize once, client-side only
`createAnalytics` returns one instance per `(endpoint, writeKey)`; calling it again returns the
same instance (and warns once). This absorbs React StrictMode double renders and effects, Fast
Refresh and HMR re-runs. On the server it returns a no-op and touches no browser global.

Page views need no router code. The SDK follows the History API, so `<Link>`, `router.push`,
`router.replace` and the back button each give exactly one page view (tested in
`e2e/tests/nextjs.spec.ts`).

## React
```tsx
import { AnalyticsProvider, useAnalytics } from "@didban/react";

root.render(
  <AnalyticsProvider endpoint="/a/e" writeKey={import.meta.env.VITE_DIDBAN_WRITE_KEY}>
    <App />
  </AnalyticsProvider>,
);

function SignupButton() {
  const analytics = useAnalytics(); // a no-op outside a provider; never throws
  return <button onClick={() => analytics.track("signup_clicked")}>Sign up</button>;
}
```

`@didban/react` needs React ≥ 18 and `@didban/analytics` as a peer (one copy of the core, so
one singleton). Provider props are the `createAnalytics` options, read once on first render.

## Next.js (App Router)
Put the provider in a `"use client"` module and use it from the root layout
(`examples/nextjs-app-router/app/providers.tsx`). The `@didban/react` entry carries
`"use client"` itself, so it can also be rendered from a server component as long as the props
are serializable (callbacks such as `onError` or `beforeSend` need your own client wrapper).

Same-origin proxy with a rewrite (`next.config.ts`):

```ts
async rewrites() {
  return [{ source: "/a/e/:path*", destination: `${process.env.COLLECTOR_URL}/:path*` }];
}
```

**Client IP caveat (verified in `e2e/tests/nextjs.spec.ts`):** Next.js rewrites pass an incoming
`X-Forwarded-For` through unchanged but never add the visitor's address. So:
- Behind Caddy/Nginx (or a platform edge that sets `X-Forwarded-For`), the chain works. The
  collector sees Next.js as the socket peer: set `TRUST_PROXY=1` on the collector (one more per
  proxy between Next.js and the collector).
- With `next start` exposed directly, every event looks like it came from the Next.js server.
  Either put Caddy/Nginx in front, or route `/a/e/*` in that front proxy straight to the
  collector (the snippets in [`sdk.md`](sdk.md#same-origin-proxy-ad-blockers)) and skip the rewrite.

404 pages: report them from `app/not-found.tsx` with `notFound(analytics)` (see the example; a
ref keeps StrictMode's second development effect from sending twice).

Script tag in Next.js (no npm package): `next/script` with `strategy="afterInteractive"` and the
same data attributes as below.

## Vite / vanilla
`examples/vanilla-vite`: `createAnalytics` in `main.ts`, modules via `autoCapture`, and
`server.proxy` + `preview.proxy` with `xfwd: true` for `/a/e` during development.

## Plain HTML (script tag)
```html
<script defer src="/js/didban.iife.js" integrity="sha384-…" crossorigin="anonymous"
  data-endpoint="/a/e" data-write-key="wk_…"></script>
```
`defer` keeps it off the critical path. Details and attributes: [`sdk.md`](sdk.md#script-tag).

## Content Security Policy
- `connect-src` must allow the collector origin. With the same-origin proxy (`/a/e`),
  `'self'` is enough.
- Script tag: `script-src` must allow the host that serves `didban.iife.js`, or serve a
  self-hosted copy from `'self'` with SRI. No inline script is needed
  (`examples/script-tag` runs under `default-src 'self'`).

## Server events (revenue)
Server events use a `write_server` key in the `X-Write-Key` header. Each event needs a `userId`
or an `anonymousId`; `userId` is stored only when the project allows identify. Server events
create no visit and are attributed to a source only when they carry the visitor's `anonymousId`
(persistent mode).

```ts
// Server only (route handler, webhook, job). DIDBAN_SERVER_KEY is a write_server key:
// never prefix it with NEXT_PUBLIC_ / VITE_ and never import this file from client code.
import { v7 as uuidv7 } from "uuid"; // event IDs are UUIDv7 or ULID

export async function reportPurchase(order: { userId: string; total: number; currency: string }) {
  const response = await fetch("https://collector.example/api/v1/ingest/batch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-write-key": process.env.DIDBAN_SERVER_KEY! },
    body: JSON.stringify({
      schemaVersion: 1,
      sentAt: new Date().toISOString(),
      events: [
        {
          eventId: uuidv7(), // keep it with the order and reuse it on retry: the server dedupes
          type: "track",
          name: "purchase_completed",
          occurredAt: new Date().toISOString(),
          url: "https://shop.example/checkout",
          userId: order.userId,
          properties: { $revenue: order.total, $currency: order.currency }, // ISO 4217
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`didban ingest failed: ${response.status}`);
}
```

The response is `{ accepted, duplicates, rejected: [{ index, code, path }], requestId }`.
`$revenue` is limited to ±1e9 and never converted between currencies.
