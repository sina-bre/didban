import type { ReactNode } from "react";
import { formatDuration, formatNumber, formatPercent } from "../lib/format";
import type { Locale } from "../lib/i18n";
import type { Column, Sort } from "../ui";

export interface BreakdownRow {
  key: string;
  label: ReactNode;
  /** Text used for sorting by the dimension column. */
  sortText: string;
  /** `null` = nothing to divide by (bounce rate of no visits); shown as "—". */
  values: Record<string, number | null>;
}

/** How a metric column is formatted. */
export type MetricKind = "count" | "percent" | "duration";

export interface BreakdownMetric {
  key: string;
  header: string;
  kind?: MetricKind;
}

/** Sorted copy; the dimension sorts by text, metrics by value; ties keep the API order. */
export function sortRows(rows: readonly BreakdownRow[], sort: Sort, locale: string) {
  const sign = sort.dir === "asc" ? 1 : -1;
  const collator = new Intl.Collator(locale);
  return [...rows].sort((a, b) =>
    sort.key === "dimension"
      ? sign * collator.compare(a.sortText, b.sortText)
      : sign * ((a.values[sort.key] ?? -1) - (b.values[sort.key] ?? -1)),
  );
}

function formatMetric(locale: Locale, kind: MetricKind, value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (kind === "percent") return formatPercent(locale, value);
  return kind === "duration" ? formatDuration(locale, value) : formatNumber(locale, value);
}

interface ColumnsInput {
  dimension: string;
  metrics: readonly BreakdownMetric[];
  /** Sum of the first metric over all rows (the share column's 100 %). */
  total: number;
  locale: Locale;
  shareHeader: string;
}

/** Dimension, the metric columns and the share of the first metric. */
export function breakdownColumns(input: ColumnsInput): Column<BreakdownRow>[] {
  const { dimension, metrics, total, locale, shareHeader } = input;
  const first = metrics[0]?.key ?? "";
  return [
    { key: "dimension", header: dimension, cell: (row) => row.label, sortable: true },
    ...metrics.map((metric) => ({
      key: metric.key,
      header: metric.header,
      numeric: true,
      sortable: true,
      cell: (row: BreakdownRow) => (
        <bdi>{formatMetric(locale, metric.kind ?? "count", row.values[metric.key])}</bdi>
      ),
    })),
    {
      key: "share",
      header: shareHeader,
      numeric: true,
      cell: (row) => (
        <bdi>{formatPercent(locale, total ? (row.values[first] ?? 0) / total : 0)}</bdi>
      ),
    },
  ];
}
