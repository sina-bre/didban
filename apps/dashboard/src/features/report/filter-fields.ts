import type { FilterField } from "@didban/contracts";
import type { MessageKey } from "../../shared/lib/i18n";

// The filter fields offered by "Add filter" (spec §3.1: every report dimension plus event name)
// and the breakdown each one's known values come from. Property filters (`prop.<key>`) are added
// from the Events report's property values.
type Row = { value?: string | null; route?: string; hostname?: string };

export interface FilterFieldSource {
  id: FilterField;
  label: MessageKey;
  report: string;
  params: Record<string, string>;
  pick: (row: Row) => string | null | undefined;
}

const value = (row: Row) => row.value;
const by = (report: string, id: FilterField): FilterFieldSource => ({
  id,
  label: `field.${id}` as MessageKey,
  report,
  params: { by: id },
  pick: value,
});

const SOURCE_FIELDS = [
  "channel",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export const FILTER_FIELDS: readonly FilterFieldSource[] = [
  { id: "route", label: "field.route", report: "pages", params: {}, pick: (r) => r.route },
  { id: "hostname", label: "field.hostname", report: "pages", params: {}, pick: (r) => r.hostname },
  {
    id: "pathname",
    label: "field.pathname",
    report: "pages",
    params: { view: "entry" },
    pick: value,
  },
  { id: "name", label: "field.name", report: "events", params: {}, pick: value },
  ...SOURCE_FIELDS.map((id) => by("sources", id)),
  ...(["country", "region", "city"] as const).map((id) => by("geo", id)),
  ...(["browser", "os", "device_type", "screen", "language"] as const).map((id) =>
    by("devices", id),
  ),
];
