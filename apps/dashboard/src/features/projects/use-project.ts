import type { Project } from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** One project. Missing and forbidden both answer 404 (spec §11 existence hiding). */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => api<Project>(`/projects/${encodeURIComponent(projectId)}`, { signal }),
  });
}
