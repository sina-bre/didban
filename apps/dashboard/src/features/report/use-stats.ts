import type { StatsCompare } from "@didban/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { api, type Query } from "../../shared/lib/api-client";
import { statsRange } from "../../shared/lib/stats-range";
import { useProject } from "../projects/use-project";

/** `?compare=previous_period` turns comparison on (spec §13.4: visible, in the URL). */
export const readCompare = (params: URLSearchParams): StatsCompare =>
  params.get("compare") === "previous_period" ? "previous_period" : "none";

/** The open project, its reporting zone and the URL's range + compare as API query fields. */
export function useReportContext() {
  const projectId = useParams().projectId ?? "";
  const [params] = useSearchParams();
  // Loaded by ProjectLayout before any report renders, so this is a cache hit.
  const timeZone = useProject(projectId).data?.reportingTimezone ?? "UTC";
  return {
    projectId,
    timeZone,
    query: { ...statsRange(params, timeZone), compare: readCompare(params) },
  };
}

/**
 * `GET /projects/:id/stats/<report>`. The previous answer stays on screen while a new range
 * loads (no flash to skeletons); leaving the page aborts the request through the signal.
 */
export function useStats<T>(projectId: string, report: string, query: Query) {
  return useQuery({
    queryKey: ["stats", projectId, report, query],
    queryFn: ({ signal }) =>
      api<T>(`/projects/${encodeURIComponent(projectId)}/stats/${report}`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}
