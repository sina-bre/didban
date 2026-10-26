import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState } from "../../shared/components";
import { ApiError } from "../../shared/lib/api-client";

/** A failed report request: the error state with its request ID and a retry. */
export function QueryFailure({ query }: { query: Pick<UseQueryResult, "error" | "refetch"> }) {
  const requestId = query.error instanceof ApiError ? query.error.requestId : undefined;
  return <ErrorState requestId={requestId} onRetry={() => void query.refetch()} />;
}
