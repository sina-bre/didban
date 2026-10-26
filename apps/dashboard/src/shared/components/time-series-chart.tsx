import { lazy, Suspense, useState } from "react";
import { formatDay, formatNumber } from "../lib/format";
import { useLocale } from "../lib/locale-context";
import { Button, type Column, DataTable, Skeleton } from "../ui";

const TimeSeriesPlot = lazy(() => import("./time-series-plot"));

export interface SeriesPoint {
  date: Date;
  value: number;
  /** Same bucket in the previous period, when comparison is on. */
  previous?: number;
}

interface Props {
  /** Names the chart and its table (e.g. "Visitors over time"). */
  title: string;
  valueLabel: string;
  points: readonly SeriesPoint[];
  /** Bucket label; defaults to the day ("Oct 3"). Reports pass hours and the project's zone. */
  formatDate?: (date: Date) => string;
  /** Time axis and first column title; defaults to "Date" (Realtime says "Time"). */
  dateLabel?: string;
}

/**
 * Time series with a visible "View as table" toggle (design system §4): the chart is lazy
 * Recharts; the table is the same data in a DataTable, also the fallback while it loads.
 */
export function TimeSeriesChart(props: Props) {
  const { title, valueLabel, points, formatDate } = props;
  const { t, locale } = useLocale();
  const [asTable, setAsTable] = useState(false);
  const day = formatDate ?? ((date: Date) => formatDay(locale, date));
  const dateLabel = props.dateLabel ?? t("chart.date");
  const value = (n: number) => formatNumber(locale, n);
  const columns: Column<SeriesPoint>[] = [
    { key: "date", header: dateLabel, cell: (p) => day(p.date) },
    { key: "value", header: valueLabel, numeric: true, cell: (p) => <bdi>{value(p.value)}</bdi> },
  ];
  if (points.some((p) => p.previous !== undefined)) {
    const cell = (p: SeriesPoint) => (
      <bdi>{p.previous === undefined ? "—" : value(p.previous)}</bdi>
    );
    columns.push({ key: "previous", header: t("chart.previous"), numeric: true, cell });
  }
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex justify-end">
        <Button aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {t("chart.showTable")}
        </Button>
      </div>
      {asTable ? (
        <DataTable
          caption={title}
          columns={columns}
          rows={points}
          rowKey={(p) => p.date.toISOString()}
        />
      ) : (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <TimeSeriesPlot
            points={points}
            valueLabel={valueLabel}
            dateLabel={dateLabel}
            previousLabel={t("chart.previous")}
            formatDay={day}
            formatValue={value}
            rtl={locale === "fa"}
          />
        </Suspense>
      )}
    </figure>
  );
}
