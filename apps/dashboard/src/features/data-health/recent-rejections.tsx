import type { DataHealthResponse } from "@didban/contracts";
import { History } from "lucide-react";
import { formatDayHour } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, type Column, DataTable } from "../../shared/ui";

type Row = DataHealthResponse["recentRejections"][number];

interface Props {
  rows: readonly Row[];
  timeZone: string;
}

/** The last rejected batches this API process saw (catalog 23.1: code, origin, time; no payloads). */
export function RecentRejections({ rows, timeZone }: Props) {
  const { t, locale } = useLocale();
  const columns: Column<Row>[] = [
    {
      key: "at",
      header: t("realtime.time"),
      cell: (r) => formatDayHour(locale, new Date(r.at), timeZone),
    },
    { key: "code", header: t("health.code"), cell: (r) => <code>{r.code}</code> },
    {
      key: "origin",
      header: t("health.origin"),
      cell: (r) => <bdi dir="ltr">{r.origin ?? "—"}</bdi>,
    },
  ];
  return (
    <Card labelledBy="recent-title">
      <CardHeader
        id="recent-title"
        icon={History}
        title={t("health.recent")}
        subline={t("health.recentHint")}
      />
      {rows.length === 0 ? (
        <p className="text-muted">{t("health.noRejections")}</p>
      ) : (
        <DataTable
          caption={t("health.recent")}
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.at}:${r.code}:${r.origin}`}
        />
      )}
    </Card>
  );
}
