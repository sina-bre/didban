import type { AuditLogResponse } from "@didban/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

const PAGE = "50";

/**
 * The organization's audit log, newest first, 50 entries per page (keyset: `before` = the last id
 * shown). `projectId` narrows it to one project (the project settings' tab).
 */
export function useAuditLog(organizationId: string, projectId?: string) {
  return useInfiniteQuery({
    queryKey: ["audit", organizationId, projectId ?? null],
    queryFn: ({ pageParam, signal }) =>
      api<AuditLogResponse>(`/organizations/${encodeURIComponent(organizationId)}/audit-log`, {
        query: { limit: PAGE, before: pageParam ?? undefined, projectId },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled: organizationId !== "",
  });
}
