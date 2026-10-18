# @didban/analytics

Privacy-friendly browser SDK for didban, a self-hosted web analytics server. Zero dependencies,
≤ 5 KB gzipped core, optional modules ≤ 1 KB each, never throws, sends nothing until idle.

```ts
import { createAnalytics } from "@didban/analytics";
import { outboundLinks } from "@didban/analytics/outbound-links";

const analytics = createAnalytics({
  endpoint: "/a/e", // same-origin proxy path, or the collector origin
  writeKey: import.meta.env.VITE_DIDBAN_WRITE_KEY,
  autoCapture: { outboundLinks: outboundLinks() },
});
analytics.track("signup_completed", { method: "email" });
```

Script tag: `<script defer src="…/didban.iife.js" data-endpoint="/a/e" data-write-key="…">`.
React: `@didban/react`. Full reference: `docs/sdk.md` and `docs/integration.md` in the didban
repository. License: MIT.
