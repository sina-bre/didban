import type { RealtimeResponse } from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

/** Spec §3.1: polled every 10 s, never cached by the API. */
export const REALTIME_POLL_MS = 10_000;

/**
 * Realtime, polled with `refetchInterval`. `refetchIntervalInBackground: false` stops the timer
 * while the tab is hidden (TanStack's focus manager follows `visibilitychange`, spec §13.4) and
 * refetches as soon as it is visible again.
 */
export function useRealtime(projectId: string) {
  return useQuery({
    queryKey: ["realtime", projectId],
    queryFn: ({ signal }) =>
      api<RealtimeResponse>(`/projects/${encodeURIComponent(projectId)}/stats/realtime`, {
        signal,
      }),
    refetchInterval: REALTIME_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });
}
