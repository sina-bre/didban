import type { Project, UpdateProjectRequest } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** `PATCH /projects/:id`; the answer replaces the cached project (every report reads its zone). */
export function useProjectUpdate(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProjectRequest) =>
      api<Project>(`/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body }),
    onSuccess: (project) => {
      client.setQueryData(["project", projectId], project);
      void client.invalidateQueries({ queryKey: ["switcher"] }); // the name may have changed
      void client.invalidateQueries({ queryKey: ["stats", projectId] });
    },
  });
}
