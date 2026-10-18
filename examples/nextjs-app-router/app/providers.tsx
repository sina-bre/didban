"use client";

import { AnalyticsProvider } from "@didban/react";
import type { ReactNode } from "react";

// Client-only wiring. The SDK singleton absorbs StrictMode double effects and Fast Refresh.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider
      endpoint="/a/e"
      writeKey={process.env.NEXT_PUBLIC_DIDBAN_WRITE_KEY ?? ""}
      trackLocalhost // this example runs on localhost; leave it off in production
    >
      {children}
    </AnalyticsProvider>
  );
}
