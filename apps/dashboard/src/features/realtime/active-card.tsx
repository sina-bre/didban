import type { RealtimeResponse } from "@didban/contracts";
import { Radio } from "lucide-react";
import { StatCard, TimeSeriesChart } from "../../shared/components";
import { formatBucket } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";

interface Props {
  data: RealtimeResponse;
  timeZone: string;
}

/** Active visitors (last 5 minutes) and page views per minute over the 30-minute window. */
export function ActiveCard({ data, timeZone }: Props) {
  const { t, locale } = useLocale();
  const points = data.pageviewsPerMinute.map((m) => ({
    date: new Date(m.minute),
    value: m.pageviews,
  }));
  return (
    <Card labelledBy="active-title">
      <CardHeader
        id="active-title"
        icon={Radio}
        title={t("realtime.active")}
        subline={t("realtime.activeHint")}
      />
      <div aria-live="polite" className="mb-4">
        <StatCard label={t("realtime.active")} value={data.activeVisitors} hero />
      </div>
      <TimeSeriesChart
        title={t("realtime.perMinute")}
        valueLabel={t("metric.pageviews")}
        points={points}
        formatDate={(date) => formatBucket(locale, date, true, timeZone)}
      />
    </Card>
  );
}
