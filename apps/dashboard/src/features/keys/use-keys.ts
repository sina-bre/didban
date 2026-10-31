import type { ApiKeyKind, ApiKeyListResponse, CreatedApiKey } from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** Write keys of every environment of the project; create (token shown once) and revoke. */
export function useKeys(projectId: string) {
  const client = useQueryClient();
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const queryKey = ["keys", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<ApiKeyListResponse>(`${base}/keys`, { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: ({ environmentId, kind }: { environmentId: string; kind: ApiKeyKind }) =>
      api<CreatedApiKey>(`${base}/environments/${encodeURIComponent(environmentId)}/keys`, {
        method: "POST",
        body: { kind },
      }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (keyId: string) =>
      api(`${base}/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { list, create, revoke };
}
