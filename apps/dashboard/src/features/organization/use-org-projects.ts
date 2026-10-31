import type { OrganizationProjectListResponse } from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** Every project of the organization, archived ones included (`org:projects`), and restore. */
export function useOrgProjects(organizationId: string) {
  const client = useQueryClient();
  const path = `/organizations/${encodeURIComponent(organizationId)}/projects`;
  const queryKey = ["org-projects", organizationId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<OrganizationProjectListResponse>(path, { signal }),
  });
  const restore = useMutation({
    mutationFn: (projectId: string) =>
      api(`${path}/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        body: { archived: false },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      await client.invalidateQueries({ queryKey: ["switcher"] });
    },
  });
  return { list, restore };
}
