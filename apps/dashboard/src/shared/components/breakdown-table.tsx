import { type ReactNode, useState } from "react";
import { formatNumber, formatPercent } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { useLocale } from "../lib/locale-context";
import { type Column, DataTable, Pagination, type Sort } from "../ui";

export interface BreakdownRow {
  key: string;
  label: ReactNode;
  /** Text used for sorting by the dimension column. */
  sortText: string;
  values: Record<string, number>;
}

interface Props {
  caption: string;
  dimension: string;
  /** Metric columns; the first one also drives the share column and the default sort. */
  metrics: readonly { key: string; header: string }[];
  rows: readonly BreakdownRow[];
  pageSize?: number;
}

/** Sorted copy; the dimension sorts by text, metrics by value; ties keep the API order. */
export function sortRows(rows: readonly BreakdownRow[], sort: Sort, locale: string) {
  const sign = sort.dir === "asc" ? 1 : -1;
  const collator = new Intl.Collator(locale);
  return [...rows].sort((a, b) =>
    sort.key === "dimension"
      ? sign * collator.compare(a.sortText, b.sortText)
      : sign * ((a.values[sort.key] ?? 0) - (b.values[sort.key] ?? 0)),
  );
}

function breakdownColumns(
  dimension: string,
  metrics: Props["metrics"],
  total: number,
  locale: Locale,
  shareHeader: string,
): Column<BreakdownRow>[] {
  const first = metrics[0]?.key ?? "";
  return [
    { key: "dimension", header: dimension, cell: (row) => row.label, sortable: true },
    ...metrics.map((metric) => ({
      key: metric.key,
      header: metric.header,
      numeric: true,
      sortable: true,
      cell: (row: BreakdownRow) => <bdi>{formatNumber(locale, row.values[metric.key] ?? 0)}</bdi>,
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

/** Pages, sources, geo, devices, events, properties: sortable, paginated, with a share column. */
export function BreakdownTable({ caption, dimension, metrics, rows, pageSize = 10 }: Props) {
  const { t, locale } = useLocale();
  const first = metrics[0]?.key ?? "";
  const [sort, setSort] = useState<Sort>({ key: first, dir: "desc" });
  const [page, setPage] = useState(0);
  const total = rows.reduce((sum, row) => sum + (row.values[first] ?? 0), 0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = sortRows(rows, sort, locale).slice(page * pageSize, (page + 1) * pageSize);
  const columns = breakdownColumns(dimension, metrics, total, locale, t("table.share"));
  const onSort = (key: string) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
    setPage(0);
  };
  return (
    <div>
      <DataTable
        caption={caption}
        columns={columns}
        rows={visible}
        rowKey={(r) => r.key}
        sort={sort}
        onSort={onSort}
      />
      {pages > 1 && (
        <Pagination
          label={t("table.pages")}
          status={t("table.page", { page: page + 1, pages })}
          previousLabel={t("table.previous")}
          nextLabel={t("table.next")}
          hasPrevious={page > 0}
          hasNext={page < pages - 1}
          onPrevious={() => setPage(page - 1)}
          onNext={() => setPage(page + 1)}
        />
      )}
    </div>
  );
}
