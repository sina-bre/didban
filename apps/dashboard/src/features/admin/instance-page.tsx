import type { AdminInstanceResponse } from "@didban/contracts";
import { Server } from "lucide-react";
import { StatCard } from "../../shared/components";
import { formatDuration } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { useAdminRead } from "./use-admin";

const MB = 1024 * 1024;

/** `/admin/instance`: runtime, database and totals for the operator (spec §11 instance health). */
export function AdminInstancePage() {
  const { t, locale } = useLocale();
  const instance = useAdminRead<AdminInstanceResponse>("instance");
  return (
    <Card labelledBy="instance-title">
      <CardHeader id="instance-title" icon={Server} title={t("admin.instance")} />
      <QueryBlock query={instance} skeleton="h-40">
        {(data) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label={t("admin.organizations")} value={data.counts.organizations} />
              <StatCard label={t("admin.users")} value={data.counts.users} />
              <StatCard label={t("org.projects")} value={data.counts.projects} />
              <StatCard label={t("admin.eventsToday")} value={data.counts.eventsToday} />
            </div>
            <dl className="grid gap-2 text-body sm:grid-cols-2">
              <Item label={t("admin.node")} value={data.node} />
              <Item label={t("admin.postgres")} value={data.postgres} />
              <Item label={t("admin.uptime")} value={formatDuration(locale, data.uptimeSeconds)} />
              <Item
                label={t("admin.database")}
                value={t("admin.megabytes", { count: Math.round(data.databaseBytes / MB) })}
              />
              <Item label={t("admin.geoIp")} value={data.geoIp ? t("admin.on") : t("admin.off")} />
            </dl>
          </div>
        )}
      </QueryBlock>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-dashed border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}
