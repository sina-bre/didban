import type { OverviewMetric, OverviewResponse } from "@didban/contracts";
import { StatCard } from "../../shared/components";
import type { MessageKey } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";

type Kind = "count" | "percent" | "duration";

const KPIS: readonly { metric: OverviewMetric; label: MessageKey; kind: Kind }[] = [
  { metric: "visitors", label: "metric.visitors", kind: "count" },
  { metric: "visits", label: "metric.visits", kind: "count" },
  { metric: "pageviews", label: "metric.pageviews", kind: "count" },
  { metric: "viewsPerVisit", label: "metric.viewsPerVisit", kind: "count" },
  { metric: "bounceRate", label: "metric.bounceRate", kind: "percent" },
  { metric: "visitDuration", label: "metric.visitDuration", kind: "duration" },
];

/** The six Overview KPIs (spec §3.1); deltas only while comparison is on. */
export function KpiGrid({ data, compare }: { data: OverviewResponse; compare: boolean }) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-6">
      {KPIS.map(({ metric, label, kind }) => {
        const { value, change } = data.metrics[metric];
        const shown =
          metric === "viewsPerVisit" && value !== null ? Math.round(value * 100) / 100 : value;
        return (
          <div
            key={metric}
            className={metric === "visitors" ? "col-span-2 md:col-span-1" : undefined}
          >
            <StatCard
              label={t(label)}
              value={shown}
              kind={kind}
              hero={metric === "visitors"}
              delta={compare ? (change === null ? null : change / 100) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
