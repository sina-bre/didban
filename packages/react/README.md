# @didban/react

React adapter for [`@didban/analytics`](../sdk), the browser SDK of didban (self-hosted web
analytics). It only wires the core instance into React: `AnalyticsProvider` and `useAnalytics()`.
The entry carries `"use client"`, so it works in the Next.js App Router.

```tsx
import { AnalyticsProvider, useAnalytics } from "@didban/react";

<AnalyticsProvider endpoint="/a/e" writeKey={process.env.NEXT_PUBLIC_DIDBAN_WRITE_KEY!}>
  <App />
</AnalyticsProvider>;

const analytics = useAnalytics();
analytics.track("signup_completed", { method: "email" });
```

Install both packages: `npm install @didban/analytics @didban/react` (React ≥ 18).
Full guide: `docs/integration.md` in the didban repository. License: MIT.
