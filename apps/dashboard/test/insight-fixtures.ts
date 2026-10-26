import type { DataHealthResponse, GoalStatsResponse } from "@didban/contracts";
import { channels } from "./stats-fixtures";

// Goals and Data health answers in the contract shapes (re-exported by report-fixtures.ts).
const meta = channels.meta;

export const goals: GoalStatsResponse = {
  meta,
  goals: [
    {
      id: "00000000-0000-4000-8000-0000000000b1",
      name: "Signed up",
      kind: "event",
      eventName: "signup",
      pathPattern: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      conversions: 7,
      visitors: 5,
      conversionRate: 0.125,
      revenue: [{ currency: "EUR", amount: "49.90" }],
    },
  ],
};

export const dataHealth: DataHealthResponse = {
  meta: { ...meta, from: "2026-10-19T10:00:00.000Z", to: "2026-10-26T10:00:00.000Z" },
  lastEventAt: "2026-10-26T09:58:00.000Z",
  eventsPerHour: [0, 1, 2].map((h) => ({ hour: `2026-10-26T0${h}:00:00.000Z`, events: h * 4 })),
  rejections: [{ code: "ORIGIN_NOT_ALLOWED", count: 12 }],
  rejectedOrigins: [
    { origin: "https://evil.example", count: 12, lastSeenAt: "2026-10-26T09:00:00.000Z" },
  ],
  pagesSeen: { count: 1000, cap: 1000, overflowing: true },
  recentRejections: [
    { at: "2026-10-26T09:00:00.000Z", code: "ORIGIN_NOT_ALLOWED", origin: "https://evil.example" },
  ],
};
