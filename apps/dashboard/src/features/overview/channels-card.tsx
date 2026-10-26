import type { BreakdownResponse, VisitRow } from "@didban/contracts";
import { Share2 } from "lucide-react";
import { ShareBars, type ShareRow } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { channelLabel } from "../report/channel-label";

/** First-touch channels by visits, as hatched share bars. */
export function ChannelsCard({ data }: { data: BreakdownResponse<VisitRow> }) {
  const { t } = useLocale();
  const total = data.rows.reduce((sum, row) => sum + row.visits, 0);
  const rows: ShareRow[] = data.rows.map((row) => ({
    key: row.value ?? "",
    label: channelLabel(t, row.value),
    value: row.visits,
    share: total === 0 ? 0 : row.visits / total,
  }));
  return (
    <Card labelledBy="channels-title">
      <CardHeader id="channels-title" icon={Share2} title={t("overview.channels")} />
      <ShareBars rows={rows} />
    </Card>
  );
}
