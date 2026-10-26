import type { DataHealthResponse } from "@didban/contracts";
import { BarChart3 } from "lucide-react";
import { TimeSeriesChart } from "../../shared/components";
import { formatDayHour } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";

interface Props {
  points: DataHealthResponse["eventsPerHour"];
  timeZone: string;
}

/** Accepted events per hour over the last 7 days (gaps show when ingestion stopped). */
export function EventsPerHour({ points, timeZone }: Props) {
  const { t, locale } = useLocale();
  const series = points.map((p) => ({ date: new Date(p.hour), value: p.events }));
  return (
    <Card labelledBy="hourly-title">
      <CardHeader id="hourly-title" icon={BarChart3} title={t("health.perHour")} />
      <TimeSeriesChart
        title={t("health.perHour")}
        valueLabel={t("health.eventsShort")}
        points={series}
        dateLabel={t("realtime.time")}
        formatDate={(date) => formatDayHour(locale, date, timeZone)}
      />
    </Card>
  );
}
