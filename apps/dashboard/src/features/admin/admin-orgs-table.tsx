import type { AdminOrganization } from "@didban/contracts";
import { ConfirmAction } from "../../shared/components";
import { formatNumber } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, type Column, DataTable, Tag } from "../../shared/ui";
import { failureText } from "../settings/failure-text";

interface Props {
  organizations: readonly AdminOrganization[];
  onSuspend: (org: AdminOrganization, suspended: boolean) => Promise<unknown>;
  onOwner: (org: AdminOrganization) => void;
}

/** Organizations with counts only: a platform admin reads no project data (spec §11). */
export function AdminOrgsTable({ organizations, onSuspend, onOwner }: Props) {
  const { t, locale } = useLocale();
  const count = (n: number) => <bdi>{formatNumber(locale, n)}</bdi>;
  const columns: Column<AdminOrganization>[] = [
    {
      key: "name",
      header: t("settings.name"),
      cell: (o) => (
        <span className="flex flex-wrap items-center gap-2">
          {o.name}
          {o.suspendedAt && <Tag tone="down">{t("admin.suspended")}</Tag>}
        </span>
      ),
    },
    { key: "members", header: t("org.members"), numeric: true, cell: (o) => count(o.members) },
    { key: "projects", header: t("org.projects"), numeric: true, cell: (o) => count(o.projects) },
    {
      key: "events",
      header: t("admin.events30"),
      numeric: true,
      cell: (o) => count(o.eventsLast30Days),
    },
    {
      key: "actions",
      header: t("goals.actions"),
      cell: (o) => (
        <span className="flex flex-wrap gap-2">
          {!o.suspendedAt && (
            <Button aria-label={t("admin.ownerFor", { name: o.name })} onClick={() => onOwner(o)}>
              {t("admin.owner")}
            </Button>
          )}
          <ConfirmAction
            label={o.suspendedAt ? t("admin.unsuspend") : t("admin.suspend")}
            name={t(o.suspendedAt ? "admin.unsuspendName" : "admin.suspendName", { name: o.name })}
            title={t(o.suspendedAt ? "admin.unsuspendName" : "admin.suspendName", { name: o.name })}
            body={t(o.suspendedAt ? "admin.unsuspendBody" : "admin.suspendBody")}
            confirm={o.suspendedAt ? t("admin.unsuspend") : t("admin.suspend")}
            onConfirm={() => onSuspend(o, !o.suspendedAt)}
            failure={(error) => failureText(t, error)}
          />
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption={t("admin.organizations")}
      columns={columns}
      rows={organizations}
      rowKey={(o) => o.id}
    />
  );
}
