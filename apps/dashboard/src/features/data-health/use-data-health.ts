import type { DataHealthResponse } from "@didban/contracts";
import { useParams } from "react-router";
import { useProject } from "../projects/use-project";
import { useStats } from "../report/use-stats";

/** `GET …/stats/data-health`: the last 7 days of ingestion, a fixed window (no range, no filters). */
export function useDataHealth() {
  const projectId = useParams().projectId ?? "";
  const timeZone = useProject(projectId).data?.reportingTimezone ?? "UTC";
  const health = useStats<DataHealthResponse>(projectId, "data-health", {});
  return { timeZone, health };
}
