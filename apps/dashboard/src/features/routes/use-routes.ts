import type {
  RoutePreviewRequest,
  RoutePreviewResponse,
  RouteTemplate,
  RouteTemplateListResponse,
  UpdateRouteTemplateRequest,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** Route templates in match order: add, move, delete, and try paths against them (spec §7). */
export function useRoutes(projectId: string) {
  const client = useQueryClient();
  const path = `/projects/${encodeURIComponent(projectId)}/routes`;
  const queryKey = ["routes", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<RouteTemplateListResponse>(path, { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: (pattern: string) =>
      api<RouteTemplate>(path, { method: "POST", body: { pattern } }),
    onSuccess: refresh,
  });
  const move = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRouteTemplateRequest }) =>
      api<RouteTemplate>(`${path}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const preview = useMutation({
    mutationFn: (body: RoutePreviewRequest) =>
      api<RoutePreviewResponse>(`${path}/preview`, { method: "POST", body }),
  });
  return { list, create, move, remove, preview };
}
