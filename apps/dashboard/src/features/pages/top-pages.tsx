import type { PageRow } from "@didban/contracts";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { BreakdownCard } from "../report/breakdown-card";
import { ExportLink } from "../report/export-link";
import { eventMetrics } from "../report/metrics";
import { useBreakdown } from "../report/use-breakdown";

/** `/pages/detail?hostname=&route=` with the current range and filters. */
export function detailHref(projectId: string, params: URLSearchParams, row: PageRow) {
  const search = new URLSearchParams(params);
  search.delete("view");
  search.set("hostname", row.hostname);
  search.set("route", row.route);
  return `/projects/${encodeURIComponent(projectId)}/pages/detail?${search}`;
}

/** Page views per (hostname, route template); each route links to its detail view. */
export function TopPages({ controls }: { controls: ReactNode }) {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const [params] = useSearchParams();
  const query = useBreakdown<PageRow>("pages", { view: "top" });
  const toRow = (row: PageRow) => ({
    key: `${row.hostname}${row.route}`,
    label: (
      <Link
        to={detailHref(projectId, params, row)}
        className="flex min-h-11 flex-col justify-center underline-offset-4 hover:underline"
      >
        <bdi dir="ltr" className="truncate">
          {row.route}
        </bdi>
        <span className="text-caption text-muted">{row.hostname}</span>
      </Link>
    ),
    sortText: row.route,
    values: { visitors: row.visitors, pageviews: row.pageviews },
  });
  return (
    <BreakdownCard
      id="pages-title"
      icon={FileText}
      title={t("pages.view.top")}
      query={query}
      dimension={t("field.route")}
      metrics={eventMetrics(t)}
      toRow={toRow}
      action={<ExportLink report="pages" params={{ view: "top" }} />}
      controls={controls}
    />
  );
}
