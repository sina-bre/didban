import type { AdminUser, AdminUserListResponse } from "@didban/contracts";
import { UserRound } from "lucide-react";
import { formatNumber } from "../../shared/lib/format";
import { formatInstant } from "../../shared/lib/format-instant";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, type Column, DataTable, Tag } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { useAdminRead } from "./use-admin";

/** `/admin/users`: every account (no hashes, no sessions). Owners come from Organizations. */
export function AdminUsersPage() {
  const { t, locale } = useLocale();
  const users = useAdminRead<AdminUserListResponse>("users");
  const columns: Column<AdminUser>[] = [
    {
      key: "email",
      header: t("members.email"),
      cell: (u) => (
        <span className="flex flex-wrap items-center gap-2">
          <bdi dir="ltr">{u.email}</bdi>
          {u.isPlatformAdmin && <Tag>{t("admin.platformAdmin")}</Tag>}
          {u.mustChangePassword && <Tag>{t("members.temporary")}</Tag>}
        </span>
      ),
    },
    {
      key: "orgs",
      header: t("admin.organizations"),
      numeric: true,
      cell: (u) => <bdi>{formatNumber(locale, u.organizations)}</bdi>,
    },
    {
      key: "created",
      header: t("keys.createdAt"),
      cell: (u) => formatInstant(locale, u.createdAt, false),
    },
  ];
  return (
    <Card labelledBy="admin-users-title">
      <CardHeader id="admin-users-title" icon={UserRound} title={t("admin.users")} />
      <p className="mb-4 max-w-prose text-body text-muted">{t("admin.usersIntro")}</p>
      <QueryBlock query={users} skeleton="h-40">
        {(data) => (
          <DataTable
            caption={t("admin.users")}
            columns={columns}
            rows={data.users}
            rowKey={(u) => u.id}
          />
        )}
      </QueryBlock>
    </Card>
  );
}
