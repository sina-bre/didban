import type {
  CreateEnvironmentRequest,
  Environment,
  EnvironmentListResponse,
  UpdateEnvironmentRequest,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** A project's environments, plus create and update (spec §9.1; never deleted, ADR 0020). */
export function useEnvironments(projectId: string) {
  const client = useQueryClient();
  const path = `/projects/${encodeURIComponent(projectId)}/environments`;
  const queryKey = ["environments", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<EnvironmentListResponse>(path, { signal }),
    enabled: projectId !== "",
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: (body: CreateEnvironmentRequest) =>
      api<Environment>(path, { method: "POST", body }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEnvironmentRequest }) =>
      api<Environment>(`${path}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });
  return { list, create, update };
}
