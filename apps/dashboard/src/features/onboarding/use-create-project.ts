import type { CreateProjectRequest, Project } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** `POST /organizations/:id/projects` (org owners/admins); the switcher lists the new project. */
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      body,
    }: {
      organizationId: string;
      body: CreateProjectRequest;
    }) =>
      api<Project>(`/organizations/${encodeURIComponent(organizationId)}/projects`, {
        method: "POST",
        body,
      }),
    onSuccess: (project) => {
      client.setQueryData(["project", project.id], project);
      void client.invalidateQueries({ queryKey: ["switcher"] });
    },
  });
}
