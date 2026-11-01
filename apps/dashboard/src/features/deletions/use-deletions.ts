import type {
  CreateDataDeletionRequest,
  DataDeletion,
  DataDeletionListResponse,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

const POLL_MS = 5_000;
const isOpen = (d: DataDeletion) => d.status === "pending" || d.status === "running";

/** The project's deletion requests (polled while one is open) and queuing a new one. */
export function useDeletions(projectId: string) {
  const client = useQueryClient();
  const path = `/projects/${encodeURIComponent(projectId)}/deletions`;
  const queryKey = ["deletions", projectId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<DataDeletionListResponse>(path, { signal }),
    refetchInterval: (query) => (query.state.data?.deletions.some(isOpen) ? POLL_MS : false),
  });
  const create = useMutation({
    mutationFn: (body: CreateDataDeletionRequest) =>
      api<DataDeletion>(path, { method: "POST", body }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return { list, create };
}
