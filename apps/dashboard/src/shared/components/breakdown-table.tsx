import { useState } from "react";
import { useLocale } from "../lib/locale-context";
import { DataTable, Pagination, type Sort } from "../ui";
import {
  type BreakdownMetric,
  type BreakdownRow,
  breakdownColumns,
  sortRows,
} from "./breakdown-columns";

export type { BreakdownMetric, BreakdownRow, MetricKind } from "./breakdown-columns";
export { sortRows };

interface Props {
  caption: string;
  dimension: string;
  /** Metric columns; the first one (a count) drives the share column and the default sort. */
  metrics: readonly BreakdownMetric[];
  rows: readonly BreakdownRow[];
  pageSize?: number;
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
  const shareHeader = t("table.share");
  const columns = breakdownColumns({ dimension, metrics, total, locale, shareHeader });
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
