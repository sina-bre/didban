import type { RealtimeResponse } from "@didban/contracts";
import { FileText, Share2 } from "lucide-react";
import { BreakdownTable, EmptyState, ShareBars } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { channelLabel } from "../report/channel-label";

/** Active pages (last 5 minutes) and top first-touch sources of the window, side by side. */
export function TopLists({ data }: { data: RealtimeResponse }) {
  const { t } = useLocale();
  const pages = data.activePages.map((p) => ({
    key: `${p.hostname}${p.route}`,
    label: <bdi dir="ltr">{p.route}</bdi>,
    sortText: p.route,
    values: { visitors: p.visitors },
  }));
  const total = data.sources.reduce((sum, s) => sum + s.visits, 0);
  const sources = data.sources.map((s) => ({
    key: s.value ?? "",
    label: channelLabel(t, s.value),
    value: s.visits,
    share: total === 0 ? 0 : s.visits / total,
  }));
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="min-w-0 lg:col-span-8">
        <Card labelledBy="pages-title">
          <CardHeader id="pages-title" icon={FileText} title={t("realtime.pages")} />
          {pages.length === 0 ? (
            <EmptyState />
          ) : (
            <BreakdownTable
              caption={t("realtime.pages")}
              dimension={t("realtime.path")}
              metrics={[{ key: "visitors", header: t("realtime.visitors") }]}
              rows={pages}
            />
          )}
        </Card>
      </div>
      <div className="min-w-0 lg:col-span-4">
        <Card labelledBy="sources-title">
          <CardHeader id="sources-title" icon={Share2} title={t("realtime.sources")} />
          {sources.length === 0 ? (
            <p className="text-muted">{t("realtime.none")}</p>
          ) : (
            <ShareBars rows={sources} />
          )}
        </Card>
      </div>
    </div>
  );
}
