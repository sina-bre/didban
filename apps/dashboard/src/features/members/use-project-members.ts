import type { ProjectMemberListResponse } from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

export type ProjectRole = ProjectMemberListResponse["members"][number]["role"];

/** Project access for org members: assign or change a role (PUT), remove it (spec §11). */
export function useProjectMembers(projectId: string) {
  const client = useQueryClient();
  const path = `/projects/${encodeURIComponent(projectId)}/members`;
  const queryKey = ["project-members", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<ProjectMemberListResponse>(path, { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      api(`${path}/${encodeURIComponent(userId)}`, { method: "PUT", body: { role } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      api(`${path}/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { list, assign, remove };
}
