import { z } from "zod";
import type { IdentityModeMeta } from "./stats.js";

// Spec §3.1 Realtime (last 30 min, polled every 10 s, never cached) and Data Health (last 7 days,
// how an operator debugs "I installed the SDK and see nothing"). Fixed windows: no from/to.
export const REALTIME_MINUTES = 30;
export const ACTIVE_MINUTES = 5;
export const DATA_HEALTH_DAYS = 7;

export const liveQuerySchema = z.object({ environmentId: z.uuid().optional() });
export type LiveQuery = z.output<typeof liveQuerySchema>;

export type LiveMeta = {
  from: string;
  to: string;
  timezone: string;
  identityMode: IdentityModeMeta;
  generatedAt: string;
};

export type RealtimeResponse = {
  meta: LiveMeta;
  /** Distinct browser visitors with an event in the last ACTIVE_MINUTES. */
  activeVisitors: number;
  /** One point per minute of the window, oldest first, empty minutes included. */
  pageviewsPerMinute: { minute: string; pageviews: number }[];
  /** Top 10 routes by visitors in the last ACTIVE_MINUTES. */
  activePages: { hostname: string; route: string; visitors: number }[];
  /** Top 10 first-touch channels of visits started in the window. */
  sources: { value: string | null; visits: number }[];
  /** The last 20 events, no visitor IDs. */
  recentEvents: {
    at: string;
    type: "page" | "track" | "identify";
    name: string | null;
    pathname: string;
    country: string | null;
  }[];
};

export type DataHealthResponse = {
  meta: LiveMeta;
  lastEventAt: string | null;
  /** UTC hours of the window, oldest first, empty hours included. */
  eventsPerHour: { hour: string; events: number }[];
  /** Ingestion rejections and drops by code (bots, origins, rate limits, invalid events, ...). */
  rejections: { code: string; count: number }[];
  /** The most frequent rejected Origin values (≤ 20 per environment and day are kept). */
  rejectedOrigins: { origin: string; count: number; lastSeenAt: string }[];
  /** `overflowing`: new routes are folded into `/__other__` — add route templates. */
  pagesSeen: { count: number; cap: number; overflowing: boolean };
  /** Last rejected batches seen by this API process (catalog 23.1; never payloads). */
  recentRejections: { at: string; code: string; origin: string | null }[];
};
