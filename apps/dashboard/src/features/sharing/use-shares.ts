import type {
  CreatedShareLink,
  CreateShareLinkRequest,
  ShareLinkListResponse,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** Public read-only links of the project: list, create (token shown once), revoke. */
export function useShares(projectId: string) {
  const client = useQueryClient();
  const path = `/projects/${encodeURIComponent(projectId)}/shares`;
  const queryKey = ["shares", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<ShareLinkListResponse>(path, { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: (body: CreateShareLinkRequest) =>
      api<CreatedShareLink>(path, { method: "POST", body }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { list, create, revoke };
}

/**
 * The URL to hand out. The token goes in the fragment, which browsers never send to a server or
 * in `Referer` (ADR 0036); the share page reads it and sends it as a header.
 */
export const shareUrl = (token: string) => `${window.location.origin}/share#${token}`;
