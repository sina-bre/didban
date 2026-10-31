import type {
  AdminInstanceResponse,
  AdminOrganizationListResponse,
  AdminUserListResponse,
  CreatedUser,
} from "@didban/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/lib/api-client";

const ORGS = ["admin", "organizations"];

/** `GET /admin/{users,instance}`: platform admins only (the API answers 403 to anyone else). */
export const useAdminRead = <T extends AdminUserListResponse | AdminInstanceResponse>(
  path: "users" | "instance",
) =>
  useQuery({
    queryKey: ["admin", path],
    queryFn: ({ signal }) => api<T>(`/admin/${path}`, { signal }),
  });

/** Organizations with counts; create, suspend or reactivate, and give one an owner (spec §11). */
export function useAdminOrganizations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ORGS });
  const list = useQuery({
    queryKey: ORGS,
    queryFn: ({ signal }) => api<AdminOrganizationListResponse>("/admin/organizations", { signal }),
  });
  const create = useMutation({
    mutationFn: (name: string) =>
      api<{ organizationId: string }>("/admin/organizations", { method: "POST", body: { name } }),
    onSuccess: refresh,
  });
  const suspend = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api(`/admin/organizations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { suspended },
      }),
    onSuccess: refresh,
  });
  const createOwner = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api<CreatedUser>(`/admin/organizations/${encodeURIComponent(id)}/owners`, {
        method: "POST",
        body: { email },
      }),
    onSuccess: async () => {
      await refresh();
      await client.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
  return { list, create, suspend, createOwner };
}
