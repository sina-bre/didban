import type { BreakdownResponse, EventRow } from "@didban/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { ListTree } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { BreakdownCard } from "../report/breakdown-card";
import { ExportLink } from "../report/export-link";
import { FilterLink } from "../report/filter-link";
import { eventCountMetrics, eventValues } from "../report/metrics";
import { SelectLink } from "./select-link";

interface Props {
  event: string;
  /** The selected property key; `null` lists the event's keys. */
  prop: string | null;
  query: UseQueryResult<BreakdownResponse<EventRow>>;
}

/** The event's property keys; a key opens its values, and a value adds a `prop.<key>` filter. */
export function PropertiesCard({ event, prop, query }: Props) {
  const { t } = useLocale();
  const title = prop ? t("events.values", { key: prop }) : t("events.keys", { event });
  const toRow = (row: EventRow) => ({
    key: row.value ?? "",
    label: prop ? (
      <FilterLink field={`prop.${prop}`} value={row.value} label={row.value ?? t("value.none")} />
    ) : (
      <SelectLink set={{ prop: row.value }} current={false} label={row.value ?? ""} code />
    ),
    sortText: row.value ?? "",
    values: eventValues(row),
  });
  return (
    <BreakdownCard
      id="properties-title"
      icon={ListTree}
      title={title}
      query={query}
      dimension={prop ? t("events.value") : t("events.key")}
      metrics={eventCountMetrics(t)}
      toRow={toRow}
      action={<ExportLink report="properties" params={{ event, ...(prop ? { key: prop } : {}) }} />}
      controls={
        prop && <SelectLink set={{ prop: null }} current={false} label={t("events.allKeys")} />
      }
    />
  );
}
