import type {
  BreakdownResponse,
  OverviewResponse,
  RealtimeResponse,
  StatsMeta,
  TimeseriesResponse,
  VisitRow,
} from "@didban/contracts";

// Stats answers in the contract shapes (UTC project, 30-day range, cookieless).
const meta: StatsMeta = {
  from: "2026-09-27T00:00:00.000Z",
  to: "2026-10-27T00:00:00.000Z",
  interval: "day",
  timezone: "UTC",
  compare: "none",
  previous: null,
  identityMode: "cookieless",
  truncated: false,
  generatedAt: "2026-10-26T10:00:00.000Z",
};

const metric = (value: number | null, change: number | null = null) => ({
  value,
  previous: null,
  change,
});

export const overview: OverviewResponse = {
  meta,
  metrics: {
    visitors: metric(1234, 12.5),
    visits: metric(1500, -4),
    pageviews: metric(4200, null),
    viewsPerVisit: metric(2.8),
    bounceRate: metric(0.42),
    visitDuration: metric(83),
  },
};

export const emptyOverview: OverviewResponse = {
  meta,
  metrics: {
    visitors: metric(0),
    visits: metric(0),
    pageviews: metric(0),
    viewsPerVisit: metric(null),
    bounceRate: metric(null),
    visitDuration: metric(null),
  },
};

const point = (day: number, visitors: number) => ({
  start: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  visitors,
  visits: visitors,
  pageviews: visitors * 3,
  viewsPerVisit: 3,
  bounceRate: 0.4,
  visitDuration: 60,
});

export const timeseries: TimeseriesResponse = {
  meta,
  points: [point(24, 10), point(25, 20), point(26, 30)],
  previous: null,
};

export const channels: BreakdownResponse<VisitRow> = {
  meta,
  rows: [
    { value: "organicSearch", visitors: 60, visits: 75, bounceRate: 0.3, visitDuration: 90 },
    { value: "direct", visitors: 20, visits: 25, bounceRate: 0.5, visitDuration: 40 },
  ],
};

export const realtime: RealtimeResponse = {
  meta: {
    from: "2026-10-26T09:30:00.000Z",
    to: "2026-10-26T10:00:00.000Z",
    timezone: "UTC",
    identityMode: "cookieless",
    generatedAt: "2026-10-26T10:00:00.000Z",
  },
  activeVisitors: 7,
  pageviewsPerMinute: [0, 1, 2].map((m) => ({
    minute: `2026-10-26T09:5${m}:00.000Z`,
    pageviews: m * 2,
  })),
  activePages: [{ hostname: "shop.example", route: "/products/:id", visitors: 4 }],
  sources: [{ value: "social", visits: 3 }],
  recentEvents: [
    { at: "2026-10-26T09:59:00.000Z", type: "page", name: null, pathname: "/", country: null },
    {
      at: "2026-10-26T09:58:00.000Z",
      type: "track",
      name: "signup",
      pathname: "/join",
      country: "DE",
    },
  ],
};
