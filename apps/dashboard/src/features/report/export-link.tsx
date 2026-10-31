import type { ExportReport } from "@didban/contracts";
import { Download } from "lucide-react";
import { use } from "react";
import { apiUrl, type Query } from "../../shared/lib/api-client";
import { useLocale } from "../../shared/lib/locale-context";
import { LinkButton } from "../../shared/ui";
import { StatsSourceContext } from "./stats-source";
import { useBreakdownQuery } from "./use-stats";

interface Props {
  report: ExportReport;
  /** The report's own parameters (`by`, `view`, `event`, `key`). */
  params?: Query;
}

/**
 * "Export CSV" (spec §3.1): a same-origin download of `…/stats/export.csv` with the table's range,
 * filters and parameters; the session cookie goes along, the API sends up to 10 000 rows.
 */
export function ExportLink({ report, params = {} }: Props) {
  const { t } = useLocale();
  const { projectId, query } = useBreakdownQuery();
  const path = `/projects/${encodeURIComponent(projectId)}/stats/export.csv`;
  // A share link reaches only SHARED_REPORTS (spec §11), and a download cannot send its header.
  if (use(StatsSourceContext)) return null;
  return (
    <LinkButton href={apiUrl(path, { report, ...query, ...params })} download>
      <Download aria-hidden="true" className="size-4" />
      {t("export.csv")}
    </LinkButton>
  );
}
