import type { BreakdownResponse } from "@didban/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  type BreakdownMetric,
  type BreakdownRow,
  BreakdownTable,
  EmptyState,
} from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { QueryBlock } from "./query-block";

interface Props<Row> {
  id: string;
  icon: LucideIcon;
  title: string;
  query: UseQueryResult<BreakdownResponse<Row>>;
  dimension: string;
  metrics: readonly BreakdownMetric[];
  toRow: (row: Row) => BreakdownRow;
  /** Header action, usually the CSV export. */
  action?: ReactNode;
  /** View or dimension choice above the table. */
  controls?: ReactNode;
  /** Replaces the table for a special state (e.g. geo not configured); `null` = the table. */
  notice?: (data: BreakdownResponse<Row>) => ReactNode;
}

/** A report card: header, controls, then the breakdown (or its empty, error, loading state). */
export function BreakdownCard<Row>(props: Props<Row>) {
  const { id, icon, title, query, dimension, metrics, toRow, action, controls, notice } = props;
  const { t } = useLocale();
  return (
    <Card labelledBy={id}>
      <CardHeader id={id} icon={icon} title={title} action={action} />
      {controls && <div className="mb-3">{controls}</div>}
      <QueryBlock query={query} skeleton="h-96">
        {(data) =>
          notice?.(data) ??
          (data.rows.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <BreakdownTable
                caption={title}
                dimension={dimension}
                metrics={metrics}
                rows={data.rows.map(toRow)}
              />
              {data.meta.truncated && (
                <p className="mt-3 text-caption text-muted">
                  {t("report.truncated", { count: data.rows.length })}
                </p>
              )}
            </>
          ))
        }
      </QueryBlock>
    </Card>
  );
}
