import type { OverviewResponse, TimeseriesResponse } from "@didban/contracts";
import { LineChart } from "lucide-react";
import { type SeriesPoint, SeriesSummary, TimeSeriesChart } from "../../shared/components";
import { formatBucket } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";

interface Props {
  series: TimeseriesResponse;
  totals: OverviewResponse["metrics"];
  timeZone: string;
}

/** Visitors per bucket (previous period dashed when comparing) and the range totals under it. */
export function VisitorsCard({ series, totals, timeZone }: Props) {
  const { t, locale } = useLocale();
  const hourly = series.meta.interval === "hour";
  const points: SeriesPoint[] = series.points.map((point, index) => {
    const previous = series.previous?.[index]?.visitors;
    return {
      date: new Date(point.start),
      value: point.visitors,
      ...(previous === undefined ? {} : { previous }),
    };
  });
  const summary = (["visitors", "visits", "pageviews"] as const).map((metric) => ({
    label: t(`metric.${metric}`),
    value: totals[metric].value ?? 0,
  }));
  return (
    <Card labelledBy="visitors-title">
      <CardHeader id="visitors-title" icon={LineChart} title={t("overview.chart")} />
      <TimeSeriesChart
        title={t("overview.chart")}
        valueLabel={t("metric.visitors")}
        points={points}
        formatDate={(date) => formatBucket(locale, date, hourly, timeZone)}
      />
      <div className="mt-4">
        <SeriesSummary items={summary} />
      </div>
    </Card>
  );
}
