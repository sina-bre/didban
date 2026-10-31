import type {
  CreatedUser,
  CreateUserRequest,
  OrganizationMemberListResponse,
  PasswordResetResponse,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

export type OrgRole = CreateUserRequest["role"];

/**
 * Organization members (ADR 0024: no invites). Owners/admins create users and get a one-time
 * temporary password; owners change roles, reset passwords and remove members.
 */
export function useOrgMembers(organizationId: string) {
  const client = useQueryClient();
  const org = `/organizations/${encodeURIComponent(organizationId)}`;
  const member = (userId: string) => `${org}/members/${encodeURIComponent(userId)}`;
  const queryKey = ["org-members", organizationId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<OrganizationMemberListResponse>(`${org}/members`, { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: (body: CreateUserRequest) =>
      api<CreatedUser>(`${org}/users`, { method: "POST", body }),
    onSuccess: refresh,
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      api(member(userId), { method: "PATCH", body: { role } }),
    onSuccess: refresh,
  });
  const resetPassword = useMutation({
    mutationFn: (userId: string) =>
      api<PasswordResetResponse>(`${member(userId)}/password-reset`, { method: "POST" }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(member(userId), { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { list, create, changeRole, resetPassword, remove };
}
