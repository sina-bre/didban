import type { ApiKeyKind } from "@didban/contracts";

// Copy-ready code for a new write key (spec §13.4): vanilla SDK, Next.js App Router, script tag,
// and a server event with `fetch`. `endpoint` is this instance's origin: the SDK posts to
// `<endpoint>/api/v1/ingest/batch` (docs/sdk.md).

export interface Snippet {
  id: "vanilla" | "nextjs" | "script" | "server";
  code: string;
}

const browser = (endpoint: string, key: string): Snippet[] => [
  {
    id: "vanilla",
    code: `import { createAnalytics } from "@didban/analytics";

createAnalytics({
  endpoint: "${endpoint}",
  writeKey: "${key}",
});`,
  },
  {
    id: "nextjs",
    code: `// app/providers.tsx, rendered by app/layout.tsx
"use client";
import { AnalyticsProvider } from "@didban/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider endpoint="${endpoint}" writeKey="${key}">
      {children}
    </AnalyticsProvider>
  );
}`,
  },
  {
    id: "script",
    code: `<!-- didban.iife.js from @didban/analytics/dist, served by your site -->
<script defer src="/js/didban.iife.js"
  data-endpoint="${endpoint}" data-write-key="${key}"></script>`,
  },
];

const server = (endpoint: string, key: string): Snippet[] => [
  {
    id: "server",
    code: `// Server only: this key is a secret. Never ship it to a browser.
import { v7 as uuidv7 } from "uuid"; // event IDs are UUIDv7 or ULID

await fetch("${endpoint}/api/v1/ingest/batch", {
  method: "POST",
  headers: { "content-type": "application/json", "x-write-key": "${key}" },
  body: JSON.stringify({
    schemaVersion: 1,
    sentAt: new Date().toISOString(),
    events: [{
      eventId: uuidv7(), // keep it with the order and reuse it on retry
      type: "track",
      name: "purchase_completed",
      occurredAt: new Date().toISOString(),
      url: "https://shop.example/checkout",
      userId: "user-42",
      properties: { $revenue: 49.9, $currency: "EUR" },
    }],
  }),
});`,
  },
];

export function snippetsFor(kind: ApiKeyKind, endpoint: string, key: string): Snippet[] {
  return kind === "write_browser" ? browser(endpoint, key) : server(endpoint, key);
}
