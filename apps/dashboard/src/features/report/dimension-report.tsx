import type { BreakdownResponse, EventRow, FilterField, VisitRow } from "@didban/contracts";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MessageKey } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";
import { Segmented } from "../../shared/ui";
import { BreakdownCard } from "./breakdown-card";
import { dimensionLabel } from "./dimension-label";
import { ExportLink } from "./export-link";
import { FilterLink } from "./filter-link";
import { eventMetrics, eventValues, visitMetrics, visitValues } from "./metrics";
import { ReportHeader } from "./report-header";
import { useBreakdown } from "./use-breakdown";
import { useUrlChoice } from "./use-url-choice";

type Row = EventRow | VisitRow;

interface Props<By extends FilterField> {
  report: "sources" | "geo" | "devices";
  title: string;
  icon: LucideIcon;
  /** The API's `by` values; the first is the default. Each is also a filter field. */
  choices: readonly By[];
  /** Sources are first-touch visits; geo and devices count events. */
  rows: "visit" | "event";
  notice?: (by: By, data: BreakdownResponse<Row>) => ReactNode;
}

/** Sources, Geo and Devices: one breakdown by a chosen dimension (`?by=`), rows add filters. */
export function DimensionReport<By extends FilterField>(props: Props<By>) {
  const { report, title, icon, choices, rows, notice } = props;
  const { t, locale } = useLocale();
  const [by, setBy] = useUrlChoice("by", choices);
  const query = useBreakdown<Row>(report, { by });
  const label = t(`field.${by}` as MessageKey);
  const options = choices.map((c) => ({ value: c, label: t(`field.${c}` as MessageKey) }));
  const toRow = (row: Row) => {
    const text = dimensionLabel({ t, locale, field: by }, row.value);
    return {
      key: row.value ?? "",
      label: <FilterLink field={by} value={row.value} label={text} />,
      sortText: text,
      values: "visits" in row ? visitValues(row) : eventValues(row),
    };
  };
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <ReportHeader title={title} />
      <BreakdownCard<Row>
        id={`${report}-title`}
        icon={icon}
        title={label}
        query={query}
        dimension={label}
        metrics={rows === "visit" ? visitMetrics(t) : eventMetrics(t)}
        toRow={toRow}
        action={<ExportLink report={report} params={{ by }} />}
        controls={
          <Segmented label={t("report.dimension")} value={by} options={options} onChange={setBy} />
        }
        notice={notice && ((data) => notice(by, data))}
      />
    </div>
  );
}
