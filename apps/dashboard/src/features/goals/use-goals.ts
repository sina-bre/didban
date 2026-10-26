import type { CreateGoalRequest, Goal, GoalStatsResponse } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";
import { useBreakdownQuery, useStats } from "../report/use-stats";

/** Goal stats for the URL's range and filters, plus create and delete (project managers). */
export function useGoals() {
  const { projectId, query } = useBreakdownQuery();
  const client = useQueryClient();
  const goals = useStats<GoalStatsResponse>(projectId, "goals", query);
  const path = `/projects/${encodeURIComponent(projectId)}/goals`;
  // Every range's goal stats changed: drop them all, the open one refetches.
  const refresh = () => client.invalidateQueries({ queryKey: ["stats", projectId, "goals"] });
  const create = useMutation({
    mutationFn: (body: CreateGoalRequest) => api<Goal>(path, { method: "POST", body }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (goalId: string) =>
      api<Goal>(`${path}/${encodeURIComponent(goalId)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { projectId, goals, create, remove };
}
