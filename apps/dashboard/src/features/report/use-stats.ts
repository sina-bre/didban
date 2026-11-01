import { formatFilter, rangeDays, type StatsCompare } from "@didban/contracts";
import { type QueryKey, useQuery } from "@tanstack/react-query";
import { use } from "react";
import { useParams, useSearchParams } from "react-router";
import { api, type Query } from "../../shared/lib/api-client";
import { daysBetween, readInterval } from "../../shared/lib/interval";
import { statsRange } from "../../shared/lib/stats-range";
import { readFilters } from "../../shared/lib/url-filters";
import { useProject } from "../projects/use-project";
import { StatsSourceContext } from "./stats-source";

/** `?compare=previous_period` turns comparison on (spec §13.4: visible, in the URL). */
export const readCompare = (params: URLSearchParams): StatsCompare =>
  params.get("compare") === "previous_period" ? "previous_period" : "none";

export type ReportContext = ReturnType<typeof reportContext>;

/** The URL's range, compare and filters as API query fields (a custom range in the reporting zone). */
export function reportContext(projectId: string, params: URLSearchParams, timeZone: string) {
  const range = statsRange(params, timeZone);
  const days = "range" in range ? rangeDays(range.range) : daysBetween(range.from, range.to);
  const filter = readFilters(params).map(formatFilter);
  return {
    projectId,
    timeZone,
    days,
    interval: readInterval(params, days),
    range,
    query: { ...range, compare: readCompare(params), filter },
  };
}

/**
 * The open project, its reporting zone and the URL's range, compare and filters as API query
 * fields. `interval` is separate: only time series send it.
 */
export function useReportContext(): ReportContext {
  const projectId = useParams().projectId ?? "";
  const [params] = useSearchParams();
  const source = use(StatsSourceContext);
  // Loaded by ProjectLayout before any report renders, so this is a cache hit.
  const project = useProject(projectId).data;
  return reportContext(projectId, params, source?.timeZone ?? project?.reportingTimezone ?? "UTC");
}

/** A project's report as query options (the first screen prefetches with the same key). */
export const statsQuery = <T>(projectId: string, report: string, query: Query) => ({
  queryKey: ["stats", projectId, report, query],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api<T>(`/projects/${encodeURIComponent(projectId)}/stats/${report}`, { query, signal }),
});

/** Range and filters without compare: what breakdowns send (they have no previous period). */
export function useBreakdownQuery(): { projectId: string; query: Query } {
  const { projectId, range, query } = useReportContext();
  return { projectId, query: { ...range, filter: query.filter } };
}

/** Fields that narrow the same table; any other change (`by`, `view`, project) is a new table. */
const NARROWING = new Set(["range", "from", "to", "compare", "filter", "interval"]);

const sameTable = (a: QueryKey, b: QueryKey) => {
  const rest = (key: QueryKey) =>
    JSON.stringify([
      key.slice(0, 3),
      Object.entries(key[3] as Query).filter(([field]) => !NARROWING.has(field)),
    ]);
  return rest(a) === rest(b);
};

/**
 * `GET /projects/:id/stats/<report>` (or the share view's source, see stats-source.ts). While a new range or filter loads, the previous answer of
 * the same table stays on screen (no flash to skeletons); another dimension or view never shows
 * the old rows under its own heading. Leaving the page aborts the request through the signal.
 */
export function useStats<T>(projectId: string, report: string, query: Query, enabled = true) {
  const source = use(StatsSourceContext);
  const own = statsQuery<T>(projectId, report, query);
  const queryKey = source ? ["stats", source.key, report, query] : own.queryKey;
  const queryFn = source
    ? ({ signal }: { signal: AbortSignal }) =>
        api<T>(source.path(report), { query, signal, headers: source.headers })
    : own.queryFn;
  return useQuery<T>({
    queryKey,
    queryFn,
    placeholderData: (previous, previousQuery) =>
      previousQuery && sameTable(previousQuery.queryKey, queryKey) ? previous : undefined,
    enabled,
  });
}
