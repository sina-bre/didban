import { Gauge } from "lucide-react";
import { EmptyState } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { ReportHeader } from "../report/report-header";
import { ChannelsCard } from "./channels-card";
import { CompareSwitch } from "./compare-switch";
import { KpiGrid } from "./kpi-grid";
import { useOverview } from "./use-overview";
import { VisitorsCard } from "./visitors-card";

/** Overview (spec §3.1): KPIs with deltas, visitors over time, channels. */
export function OverviewPage() {
  const { t } = useLocale();
  const { chart, compare, overview, series, channels, empty, cookielessNote } = useOverview();
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5" aria-busy={overview.isFetching}>
      <ReportHeader title={t("nav.overview")}>
        <CompareSwitch />
      </ReportHeader>
      <Card labelledBy="kpi-title">
        <CardHeader id="kpi-title" icon={Gauge} title={t("overview.kpis")} />
        <QueryBlock query={overview} skeleton="h-28">
          {(data) =>
            empty ? <EmptyState /> : <KpiGrid data={data} compare={compare !== "none"} />
          }
        </QueryBlock>
        {cookielessNote && (
          <p className="mt-4 text-caption text-muted">{t("overview.cookieless")}</p>
        )}
      </Card>
      {!empty && (
        <div className="grid gap-3 md:gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="min-w-0 lg:col-span-8">
            <QueryBlock query={series} skeleton="h-96">
              {(data) =>
                overview.data && (
                  <VisitorsCard series={data} totals={overview.data.metrics} {...chart} />
                )
              }
            </QueryBlock>
          </div>
          <div className="min-w-0 lg:col-span-4">
            <QueryBlock query={channels} skeleton="h-96">
              {(data) => <ChannelsCard data={data} />}
            </QueryBlock>
          </div>
        </div>
      )}
    </div>
  );
}
