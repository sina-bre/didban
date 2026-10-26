import type { EventRow, VisitRow } from "@didban/contracts";
import type { BreakdownMetric } from "../../shared/components";
import type { Translate } from "../../shared/lib/i18n";

// The metric columns of the two row shapes (contracts): event rows (pages, geo, devices) and
// visit rows (sources, entry/exit pages, first touch).

export const eventMetrics = (t: Translate): BreakdownMetric[] => [
  { key: "visitors", header: t("metric.visitors") },
  { key: "pageviews", header: t("metric.pageviews") },
];

export const eventValues = (row: EventRow) => ({
  visitors: row.visitors,
  pageviews: row.pageviews,
  events: row.events,
});

/** Custom events: how often, and by how many browser visitors. */
export const eventCountMetrics = (t: Translate): BreakdownMetric[] => [
  { key: "events", header: t("events.count") },
  { key: "visitors", header: t("metric.visitors") },
];

export const visitMetrics = (t: Translate): BreakdownMetric[] => [
  { key: "visitors", header: t("metric.visitors") },
  { key: "visits", header: t("metric.visits") },
  { key: "bounceRate", header: t("metric.bounceRate"), kind: "percent" },
  { key: "visitDuration", header: t("metric.visitDuration"), kind: "duration" },
];

export const visitValues = (row: VisitRow) => ({
  visitors: row.visitors,
  visits: row.visits,
  bounceRate: row.bounceRate,
  visitDuration: row.visitDuration,
});
