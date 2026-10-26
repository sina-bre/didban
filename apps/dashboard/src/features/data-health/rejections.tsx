import type { DataHealthResponse } from "@didban/contracts";
import { Ban, Globe } from "lucide-react";
import { formatDayHour, formatNumber } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, type Column, DataTable } from "../../shared/ui";

interface Props {
  data: DataHealthResponse;
  timeZone: string;
}

type Code = DataHealthResponse["rejections"][number];
type Origin = DataHealthResponse["rejectedOrigins"][number];

/** Rejections by code and the most frequent rejected origins (wrong allowed-origins setting). */
export function Rejections({ data, timeZone }: Props) {
  const { t, locale } = useLocale();
  const count = (n: number) => <bdi>{formatNumber(locale, n)}</bdi>;
  const codes: Column<Code>[] = [
    { key: "code", header: t("health.code"), cell: (r) => <code>{r.code}</code> },
    { key: "count", header: t("health.count"), numeric: true, cell: (r) => count(r.count) },
  ];
  const origins: Column<Origin>[] = [
    { key: "origin", header: t("health.origin"), cell: (r) => <bdi dir="ltr">{r.origin}</bdi> },
    { key: "count", header: t("health.count"), numeric: true, cell: (r) => count(r.count) },
    {
      key: "last",
      header: t("health.lastSeen"),
      numeric: true,
      cell: (r) => formatDayHour(locale, new Date(r.lastSeenAt), timeZone),
    },
  ];
  const none = <p className="text-muted">{t("health.noRejections")}</p>;
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-2 lg:gap-5">
      <Card labelledBy="codes-title">
        <CardHeader id="codes-title" icon={Ban} title={t("health.rejections")} />
        {data.rejections.length === 0 ? (
          none
        ) : (
          <DataTable
            caption={t("health.rejections")}
            columns={codes}
            rows={data.rejections}
            rowKey={(r) => r.code}
          />
        )}
      </Card>
      <Card labelledBy="origins-title">
        <CardHeader id="origins-title" icon={Globe} title={t("health.origins")} />
        {data.rejectedOrigins.length === 0 ? (
          none
        ) : (
          <DataTable
            caption={t("health.origins")}
            columns={origins}
            rows={data.rejectedOrigins}
            rowKey={(r) => r.origin}
          />
        )}
      </Card>
    </div>
  );
}
