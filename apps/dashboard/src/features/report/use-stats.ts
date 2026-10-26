import { formatFilter, type StatsCompare } from "@didban/contracts";
import { type QueryKey, useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { api, type Query } from "../../shared/lib/api-client";
import { daysBetween, readInterval } from "../../shared/lib/interval";
import { statsRange } from "../../shared/lib/stats-range";
import { readFilters } from "../../shared/lib/url-filters";
import { useProject } from "../projects/use-project";

/** `?compare=previous_period` turns comparison on (spec §13.4: visible, in the URL). */
export const readCompare = (params: URLSearchParams): StatsCompare =>
  params.get("compare") === "previous_period" ? "previous_period" : "none";

/**
 * The open project, its reporting zone and the URL's range, compare and filters as API query
 * fields. `interval` is separate: only time series send it.
 */
export function useReportContext() {
  const projectId = useParams().projectId ?? "";
  const [params] = useSearchParams();
  // Loaded by ProjectLayout before any report renders, so this is a cache hit.
  const timeZone = useProject(projectId).data?.reportingTimezone ?? "UTC";
  const range = statsRange(params, timeZone);
  const days = daysBetween(range.from, range.to);
  const filter = readFilters(params).map(formatFilter);
  return {
    projectId,
    timeZone,
    days,
    interval: readInterval(params, days),
    query: { ...range, compare: readCompare(params), filter },
  };
}

/** Range and filters without compare: what breakdowns send (they have no previous period). */
export function useBreakdownQuery(): { projectId: string; query: Query } {
  const { projectId, query } = useReportContext();
  return { projectId, query: { from: query.from, to: query.to, filter: query.filter } };
}

/** Fields that narrow the same table; any other change (`by`, `view`, project) is a new table. */
const NARROWING = new Set(["from", "to", "compare", "filter", "interval"]);

const sameTable = (a: QueryKey, b: QueryKey) => {
  const rest = (key: QueryKey) =>
    JSON.stringify([
      key.slice(0, 3),
      Object.entries(key[3] as Query).filter(([field]) => !NARROWING.has(field)),
    ]);
  return rest(a) === rest(b);
};

/**
 * `GET /projects/:id/stats/<report>`. While a new range or filter loads, the previous answer of
 * the same table stays on screen (no flash to skeletons); another dimension or view never shows
 * the old rows under its own heading. Leaving the page aborts the request through the signal.
 */
export function useStats<T>(projectId: string, report: string, query: Query, enabled = true) {
  const queryKey = ["stats", projectId, report, query];
  return useQuery<T>({
    queryKey,
    queryFn: ({ signal }) =>
      api<T>(`/projects/${encodeURIComponent(projectId)}/stats/${report}`, { query, signal }),
    placeholderData: (previous, previousQuery) =>
      previousQuery && sameTable(previousQuery.queryKey, queryKey) ? previous : undefined,
    enabled,
  });
}
