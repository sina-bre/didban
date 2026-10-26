import type { EventRow } from "@didban/contracts";
import { MousePointerClick } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { BreakdownCard } from "../report/breakdown-card";
import { ExportLink } from "../report/export-link";
import { eventCountMetrics, eventValues } from "../report/metrics";
import { ReportHeader } from "../report/report-header";
import { PropertiesCard } from "./properties-card";
import { SelectLink } from "./select-link";
import { useEvents } from "./use-events";

/** Events (spec §3.1): counts and visitors per event; a selected event shows its properties. */
export function EventsPage() {
  const { t } = useLocale();
  const { event, prop, events, properties } = useEvents();
  const toRow = (row: EventRow) => ({
    key: row.value ?? "",
    label: (
      <SelectLink
        set={{ event: row.value, prop: null }}
        current={row.value === event}
        label={row.value ?? t("value.none")}
        code
      />
    ),
    sortText: row.value ?? "",
    values: eventValues(row),
  });
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <ReportHeader title={t("nav.events")} />
      <div className="grid gap-3 md:gap-4 lg:grid-cols-2 lg:gap-5">
        <BreakdownCard
          id="events-title"
          icon={MousePointerClick}
          title={t("events.title")}
          query={events}
          dimension={t("field.name")}
          metrics={eventCountMetrics(t)}
          toRow={toRow}
          action={<ExportLink report="events" />}
        />
        {event ? (
          <PropertiesCard event={event} prop={prop} query={properties} />
        ) : (
          <p className="self-center text-center text-muted">{t("events.pick")}</p>
        )}
      </div>
    </div>
  );
}
