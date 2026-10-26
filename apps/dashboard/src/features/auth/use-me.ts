import type { MeResponse } from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

export const ME_KEY = ["me"] as const;

/** The signed-in user. A 401 here is an expired session: the api-client sends us to /login. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => api<MeResponse>("/auth/me", { signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
