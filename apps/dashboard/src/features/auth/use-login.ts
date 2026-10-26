import type { LoginRequest, MeResponse } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";
import { ME_KEY } from "./use-me";

/** `POST /auth/login`. A 401 `INVALID_CREDENTIALS` is an answer, not a redirect. */
export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api<MeResponse>("/auth/login", { method: "POST", body }),
    onSuccess: (me) => {
      // A new session: nothing cached under a previous user may survive (spec §11 isolation).
      client.clear();
      client.setQueryData(ME_KEY, me);
    },
  });
}
