import type { BreakdownResponse } from "@didban/contracts";
import type { Query } from "../../shared/lib/api-client";
import { useBreakdownQuery, useStats } from "./use-stats";

/** Rows per breakdown request: the API's maximum; the table pages through them 10 at a time. */
export const BREAKDOWN_LIMIT = "100";

/** `GET …/stats/<report>` with the URL's range and filters plus the report's own parameters. */
export function useBreakdown<Row>(report: string, params: Query = {}, enabled = true) {
  const { projectId, query } = useBreakdownQuery();
  return useStats<BreakdownResponse<Row>>(
    projectId,
    report,
    { ...query, ...params, limit: BREAKDOWN_LIMIT },
    enabled,
  );
}
