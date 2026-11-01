import type {
  BreakdownResponse,
  OverviewResponse,
  TimeseriesResponse,
  VisitRow,
} from "@didban/contracts";
import { type ReportContext, useReportContext, useStats } from "../report/use-stats";

/** The query fields of the three Overview reports (the first screen prefetches the same). */
export const overviewQueries = ({ query, interval }: ReportContext) => ({
  overview: query,
  timeseries: { ...query, ...(interval === "auto" ? {} : { interval }) },
  sources: { from: query.from, to: query.to, filter: query.filter, by: "channel", limit: "6" },
});

/** The three Overview requests, run in parallel: KPIs, the time series and channels. */
export function useOverview() {
  const context = useReportContext();
  const { projectId, timeZone, days, interval, query } = context;
  const fields = overviewQueries(context);
  const overview = useStats<OverviewResponse>(projectId, "overview", fields.overview);
  const series = useStats<TimeseriesResponse>(projectId, "timeseries", fields.timeseries);
  const channels = useStats<BreakdownResponse<VisitRow>>(projectId, "sources", fields.sources);
  const data = overview.data;
  const empty = data?.metrics.pageviews.value === 0 && data.metrics.visits.value === 0;
  // Spec §4: cookieless visitors are counted per day, so totals over several days run high.
  const span = data ? (Date.parse(data.meta.to) - Date.parse(data.meta.from)) / 86_400_000 : 0;
  const cookielessNote = data?.meta.identityMode === "cookieless" && span > 1.5;
  const chart = { days, interval, timeZone };
  return { chart, compare: query.compare, overview, series, channels, empty, cookielessNote };
}
