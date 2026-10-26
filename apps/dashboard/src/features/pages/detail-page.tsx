import { ArrowLeft, Gauge } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { StatCard } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { NotFoundPage } from "../not-found/page";
import { QueryBlock } from "../report/query-block";
import { ReportHeader } from "../report/report-header";
import { ScrollDepthCard } from "./scroll-depth-card";
import { usePageDetail } from "./use-page-detail";

/** One page (spec §3.1 page detail + catalog 23.2 scroll depth and engaged time). */
export function PageDetailPage() {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const { projectId, hostname, route, detail } = usePageDetail();
  if (!hostname || !route) return <NotFoundPage />;
  const back = new URLSearchParams(params);
  back.delete("hostname");
  back.delete("route");
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5" aria-busy={detail.isFetching}>
      <Link
        to={`/projects/${encodeURIComponent(projectId)}/pages?${back}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-accent-text underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("pages.back")}
      </Link>
      <ReportHeader title={route}>
        <span className="text-muted">{hostname}</span>
      </ReportHeader>
      <QueryBlock query={detail} skeleton="h-72">
        {(data) => (
          <>
            <Card labelledBy="detail-title">
              <CardHeader id="detail-title" icon={Gauge} title={t("pages.detail")} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">
                <StatCard label={t("metric.visitors")} value={data.visitors} />
                <StatCard label={t("metric.pageviews")} value={data.pageviews} />
                <StatCard label={t("pages.engaged")} value={data.engagedSeconds} kind="duration" />
              </div>
              {data.engagedSeconds === null && (
                <p className="mt-4 text-caption text-muted">{t("pages.engagedOff")}</p>
              )}
            </Card>
            <ScrollDepthCard depth={data.scrollDepth} visitors={data.visitors} />
          </>
        )}
      </QueryBlock>
    </div>
  );
}
