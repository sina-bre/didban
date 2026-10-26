import type { VisitRow } from "@didban/contracts";
import { LogIn, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { BreakdownCard } from "../report/breakdown-card";
import { ExportLink } from "../report/export-link";
import { FilterLink } from "../report/filter-link";
import { visitMetrics, visitValues } from "../report/metrics";
import { useBreakdown } from "../report/use-breakdown";

interface Props {
  view: "entry" | "exit";
  controls: ReactNode;
}

/** The first or last path of each visit, with that visit's bounce rate and duration. */
export function EntryExitPages({ view, controls }: Props) {
  const { t } = useLocale();
  const query = useBreakdown<VisitRow>("pages", { view });
  const toRow = (row: VisitRow) => ({
    key: row.value ?? "",
    label: <FilterLink field="pathname" value={row.value} label={row.value ?? t("value.none")} />,
    sortText: row.value ?? "",
    values: visitValues(row),
  });
  return (
    <BreakdownCard
      id="pages-title"
      icon={view === "entry" ? LogIn : LogOut}
      title={t(`pages.view.${view}`)}
      query={query}
      dimension={t("field.pathname")}
      metrics={visitMetrics(t)}
      toRow={toRow}
      action={<ExportLink report="pages" params={{ view }} />}
      controls={controls}
    />
  );
}
