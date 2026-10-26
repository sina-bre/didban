import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../shared/lib/api-client";

// All server state goes through TanStack Query (spec §13.1). 4xx answers are final (a retry
// cannot turn a 404 into a project); network errors and 5xx retry twice.
const MAX_RETRIES = 2;

export function retryable(failures: number, error: unknown): boolean {
  if (failures >= MAX_RETRIES) return false;
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // 30 s: the API caches stats for 15 s (ADR 0035); switching reports should not refetch.
      queries: { staleTime: 30_000, retry: retryable },
      mutations: { retry: false },
    },
  });
}
