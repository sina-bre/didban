import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** End-aligned, tabular figures. */
  numeric?: boolean;
  sortable?: boolean;
}

export interface Sort {
  key: string;
  dir: "asc" | "desc";
}

interface Props<Row> {
  caption: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  sort?: Sort;
  onSort?: (key: string) => void;
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/**
 * Native `<table>` (ADR 0004) with muted headers and dashed row separators. On small screens the
 * table scrolls sideways inside a focusable region while the first column stays put.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey, sort, onSort }: Props<Row>) {
  const align = (column: Column<Row>) => (column.numeric ? "text-end tabular-nums" : "text-start");
  const sticky = (index: number) => (index === 0 ? "sticky start-0 bg-surface" : "");
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
    <section aria-label={caption} tabIndex={0} className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={sort?.key === column.key ? ARIA_SORT[sort.dir] : undefined}
                className={`h-11 whitespace-nowrap px-2 font-normal text-muted ${align(column)} ${sticky(index)}`}
              >
                {column.sortable && onSort ? (
                  <SortButton
                    label={column.header}
                    dir={sort?.key === column.key ? sort.dir : undefined}
                    onClick={() => onSort(column.key)}
                  />
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-dashed border-line">
              {columns.map((column, index) => (
                <td key={column.key} className={`h-11 px-2 ${align(column)} ${sticky(index)}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SortButton(props: { label: string; dir: Sort["dir"] | undefined; onClick: () => void }) {
  const Icon = props.dir === "asc" ? ArrowUp : props.dir === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex min-h-11 items-center gap-1 hover:text-ink"
    >
      {props.label}
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}
