import type { Project } from "@didban/contracts";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

export const projectQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => api<Project>(`/projects/${encodeURIComponent(projectId)}`, { signal }),
  });

/** One project. Missing and forbidden both answer 404 (spec §11 existence hiding). */
export function useProject(projectId: string) {
  // The public share view has no project route.
  return useQuery({ ...projectQuery(projectId), enabled: projectId !== "" });
}
