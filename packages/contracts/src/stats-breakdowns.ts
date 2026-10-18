import { z } from "zod";
import { EVENT_NAME_PATTERN, PROPERTY_KEY_PATTERN } from "./limits.js";
import { type StatsMeta, statsQueryBase, withRangeCheck } from "./stats.js";

// Spec §10 breakdown endpoints. Aggregates are not paginated: `limit` (default 10, max 100) rows,
// `meta.truncated` = there were more.
export const MAX_BREAKDOWN_ROWS = 100;
const limit = z.coerce.number().int().min(1).max(MAX_BREAKDOWN_ROWS).default(10);

export const PAGE_VIEWS = ["top", "entry", "exit", "discovered"] as const;
export const SOURCE_DIMENSIONS = [
  "referrer",
  "channel",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export const GEO_DIMENSIONS = ["country", "region", "city"] as const;
export const DEVICE_DIMENSIONS = ["browser", "os", "device_type", "screen", "language"] as const;

export const pagesQuerySchema = withRangeCheck(
  statsQueryBase.extend({ limit, view: z.enum(PAGE_VIEWS).default("top") }),
);
export const pageDetailQuerySchema = withRangeCheck(
  statsQueryBase.extend({
    hostname: z.string().min(1).max(253),
    route: z.string().min(1).max(2048),
  }),
);
export const sourcesQuerySchema = withRangeCheck(
  statsQueryBase.extend({ limit, by: z.enum(SOURCE_DIMENSIONS).default("channel") }),
);
export const geoQuerySchema = withRangeCheck(
  statsQueryBase.extend({ limit, by: z.enum(GEO_DIMENSIONS).default("country") }),
);
export const devicesQuerySchema = withRangeCheck(
  statsQueryBase.extend({ limit, by: z.enum(DEVICE_DIMENSIONS).default("browser") }),
);
export const eventsQuerySchema = withRangeCheck(statsQueryBase.extend({ limit }));
/** Without `key`: the property keys of the event; with `key`: that key's values. */
export const eventPropertiesQuerySchema = withRangeCheck(
  statsQueryBase.extend({ limit, key: z.string().regex(PROPERTY_KEY_PATTERN).optional() }),
);

export type PagesQuery = z.output<typeof pagesQuerySchema>;
export type PageDetailQuery = z.output<typeof pageDetailQuerySchema>;
export type SourcesQuery = z.output<typeof sourcesQuerySchema>;
export type GeoQuery = z.output<typeof geoQuerySchema>;
export type DevicesQuery = z.output<typeof devicesQuerySchema>;
export type EventsQuery = z.output<typeof eventsQuerySchema>;
export type EventPropertiesQuery = z.output<typeof eventPropertiesQuerySchema>;

/** Event-based rows (pages, geo, devices, events, properties). `value` null = not recorded. */
export type EventRow = {
  value: string | null;
  visitors: number;
  pageviews: number;
  events: number;
};
/** Visit-based rows (sources = first touch, entry/exit pages). */
export type VisitRow = {
  value: string | null;
  visitors: number;
  visits: number;
  bounceRate: number | null;
  visitDuration: number | null;
};
export type PageRow = { hostname: string; route: string; visitors: number; pageviews: number };
export type DiscoveredPageRow = {
  hostname: string;
  route: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastTitle: string | null;
};

export type BreakdownResponse<Row> = { meta: StatsMeta; rows: Row[] };

/** Catalog 23.2: scroll depth and engaged time per page, `null` when the module sent nothing. */
export type PageDetailResponse = {
  meta: StatsMeta;
  visitors: number;
  pageviews: number;
  /** Visitors that reached 25 / 50 / 75 / 100 %. */
  scrollDepth: { percent: number; visitors: number }[] | null;
  /** Average engaged seconds per page view that reported it. */
  engagedSeconds: number | null;
};

/** `GET …/stats/export.csv?report=…` plus that report's own parameters (catalog: ≤ 10 000 rows). */
export const EXPORT_REPORTS = ["pages", "sources", "geo", "devices", "events", "properties"] as const;
export const MAX_EXPORT_ROWS = 10_000;
export const exportQuerySchema = z.object({
  report: z.enum(EXPORT_REPORTS),
  /** The event whose properties are exported (`report=properties`). */
  event: z.string().regex(EVENT_NAME_PATTERN).optional(),
});
export type ExportReport = (typeof EXPORT_REPORTS)[number];
