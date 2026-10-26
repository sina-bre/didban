import type { RealtimeResponse } from "@didban/contracts";
import { MousePointerClick } from "lucide-react";
import { formatBucket } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, type Column, DataTable } from "../../shared/ui";

type RecentEvent = RealtimeResponse["recentEvents"][number];

interface Props {
  events: readonly RecentEvent[];
  timeZone: string;
}

/** The last 20 events (no visitor IDs: the API never sends them). */
export function RecentEvents({ events, timeZone }: Props) {
  const { t, locale } = useLocale();
  const columns: Column<RecentEvent>[] = [
    {
      key: "at",
      header: t("realtime.time"),
      cell: (e) => <bdi>{formatBucket(locale, new Date(e.at), true, timeZone)}</bdi>,
    },
    {
      key: "event",
      header: t("realtime.event"),
      cell: (e) => (e.type === "page" ? t("realtime.pageview") : (e.name ?? e.type)),
    },
    { key: "path", header: t("realtime.path"), cell: (e) => <bdi dir="ltr">{e.pathname}</bdi> },
  ];
  return (
    <Card labelledBy="recent-title">
      <CardHeader id="recent-title" icon={MousePointerClick} title={t("realtime.recent")} />
      {events.length === 0 ? (
        <p className="text-muted">{t("realtime.none")}</p>
      ) : (
        <DataTable
          caption={t("realtime.recent")}
          columns={columns}
          rows={events}
          rowKey={(e) => `${e.at}${e.type}${e.name ?? ""}${e.pathname}`}
        />
      )}
    </Card>
  );
}
