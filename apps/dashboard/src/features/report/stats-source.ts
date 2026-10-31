import { createContext } from "react";

/**
 * Where the report components read stats. `null` (default): the open project's
 * `/projects/:id/stats/*` with the session. The public share view (`/share`) provides one that
 * reads `/share/stats/*` with the `X-Share-Token` header, so the same components render there.
 */
export interface StatsSource {
  /** Query-cache key part in place of the project id. */
  key: string;
  path: (report: string) => string;
  headers: Record<string, string>;
  timeZone: string;
}

export const StatsSourceContext = createContext<StatsSource | null>(null);
