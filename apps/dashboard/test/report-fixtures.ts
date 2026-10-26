import type {
  BreakdownResponse,
  DiscoveredPageRow,
  EventRow,
  PageDetailResponse,
  PageRow,
  StatsMeta,
  VisitRow,
} from "@didban/contracts";
import { PROJECT } from "./fixtures";
import { dataHealth, goals } from "./insight-fixtures";
import { channels } from "./stats-fixtures";

export { dataHealth, goals };

// Stage 5d report answers in the contract shapes. Handlers read the query like the API does.
const meta: StatsMeta = { ...channels.meta };
const rows = <Row>(list: Row[], truncated = false): BreakdownResponse<Row> => ({
  meta: { ...meta, truncated },
  rows: list,
});
const event = (value: string | null, visitors: number, events = visitors): EventRow => ({
  value,
  visitors,
  pageviews: visitors * 2,
  events,
});
const visit = (value: string | null, visitors: number): VisitRow => ({
  value,
  visitors,
  visits: visitors + 1,
  bounceRate: 0.25,
  visitDuration: 95,
});

export const topPages = rows<PageRow>([
  { hostname: "shop.example", route: "/products/:id", visitors: 40, pageviews: 90 },
  { hostname: "shop.example", route: "/", visitors: 30, pageviews: 35 },
]);
export const discovered = rows<DiscoveredPageRow>([
  {
    hostname: "shop.example",
    route: "/sale",
    firstSeenAt: "2026-10-20T08:00:00.000Z",
    lastSeenAt: "2026-10-25T08:00:00.000Z",
    lastTitle: "Autumn sale",
  },
]);
export const pageDetail: PageDetailResponse = {
  meta,
  visitors: 40,
  pageviews: 90,
  scrollDepth: [25, 50, 75, 100].map((percent) => ({ percent, visitors: 40 - percent / 5 })),
  engagedSeconds: 42,
};

const geoRows: Record<string, BreakdownResponse<EventRow>> = {
  country: rows([event("DE", 12), event("IR", 8)]),
  region: rows([event("DE-BY", 12)]),
  city: rows([event(null, 20)]),
};
const deviceRows: Record<string, BreakdownResponse<EventRow>> = {
  browser: rows([event("Chrome", 30), event("Firefox", 10)]),
  device_type: rows([event("mobile", 25), event("desktop", 15)]),
};
const sourceRows: Record<string, BreakdownResponse<VisitRow>> = {
  channel: channels,
  referrer: rows([visit("news.example", 9), visit(null, 3)], true),
};
const by = (table: Record<string, unknown>, fallback: string) => (url: URL) => ({
  body: table[url.searchParams.get("by") ?? fallback] ?? rows([]),
});

export const events = rows([event("signup", 5, 7), event("purchase_completed", 2, 3)]);
const propertyRows = (url: URL) => ({
  body:
    url.searchParams.get("key") === "plan"
      ? rows([event("pro", 3), event("free", 2)])
      : rows([event("plan", 5), event("source", 1)]),
});

const stats = `GET /projects/${PROJECT}/stats`;

/** Every 5d report of PROJECT; spread over `signedIn()`. */
export const reports = () => ({
  [`${stats}/pages`]: (url: URL) => ({
    body:
      { top: topPages, discovered }[url.searchParams.get("view") ?? "top"] ??
      rows([visit("/landing", 20)]),
  }),
  [`${stats}/pages/detail`]: pageDetail,
  [`${stats}/sources`]: by(sourceRows, "channel"),
  [`${stats}/geo`]: by(geoRows, "country"),
  [`${stats}/devices`]: by(deviceRows, "browser"),
  [`${stats}/events`]: events,
  [`${stats}/events/signup/properties`]: propertyRows,
  [`${stats}/goals`]: goals,
  [`${stats}/data-health`]: dataHealth,
});
