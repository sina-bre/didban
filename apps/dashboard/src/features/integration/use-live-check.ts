import type { DataHealthResponse, RealtimeResponse } from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../../shared/lib/api-client";
import { likelyCause } from "./likely-cause";

/** How often the check asks Realtime, and when it starts reading the diagnostics. */
export const POLL_MS = 3000;
export const CHECK_TIMEOUT_MS = 30_000;

/**
 * "Waiting for the first event" (spec §13.4): polls the environment's Realtime until an event
 * shows up. After CHECK_TIMEOUT_MS it also polls Data Health and names the likely cause.
 * `restart()` begins a new wait (after fixing the cause).
 */
export function useLiveCheck(projectId: string, environmentId: string) {
  const [round, setRound] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new round restarts the timer
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), CHECK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [round]);
  const base = `/projects/${encodeURIComponent(projectId)}/stats`;
  const query = { environmentId };
  const realtime = useQuery({
    queryKey: ["live-check", projectId, environmentId, round],
    queryFn: ({ signal }) => api<RealtimeResponse>(`${base}/realtime`, { query, signal }),
    refetchInterval: (q) => ((q.state.data?.recentEvents.length ?? 0) > 0 ? false : POLL_MS),
  });
  const received = (realtime.data?.recentEvents.length ?? 0) > 0;
  const health = useQuery({
    queryKey: ["live-check-health", projectId, environmentId, round],
    queryFn: ({ signal }) => api<DataHealthResponse>(`${base}/data-health`, { query, signal }),
    enabled: timedOut && !received,
    refetchInterval: POLL_MS,
  });
  const restart = () => {
    setTimedOut(false);
    setRound((n) => n + 1);
  };
  return {
    received,
    timedOut: timedOut && !received,
    cause: health.data ? likelyCause(health.data) : undefined,
    failed: realtime.isError,
    restart,
  };
}
