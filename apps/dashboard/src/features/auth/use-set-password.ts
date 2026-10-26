import type { ChangePasswordRequest, MeResponse } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";
import { ME_KEY } from "./use-me";

/** `POST /auth/password`. A wrong current password is `INVALID_CREDENTIALS`. */
export function useSetPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      api<void>("/auth/password", { method: "POST", body }),
    onSuccess: () => {
      client.setQueryData<MeResponse>(ME_KEY, (me) =>
        me ? { user: { ...me.user, mustChangePassword: false } } : me,
      );
    },
  });
}
