import type { PageDetailResponse } from "@didban/contracts";
import { ArrowDownToLine } from "lucide-react";
import { ShareBars } from "../../shared/components";
import { formatPercent } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";

interface Props {
  depth: PageDetailResponse["scrollDepth"];
  visitors: number;
}

/** Visitors that reached 25 / 50 / 75 / 100 % of the page; "not collected" without the module. */
export function ScrollDepthCard({ depth, visitors }: Props) {
  const { t, locale } = useLocale();
  const rows = (depth ?? []).map((step) => ({
    key: String(step.percent),
    label: t("pages.reached", { percent: formatPercent(locale, step.percent / 100) }),
    value: step.visitors,
    share: visitors === 0 ? 0 : step.visitors / visitors,
  }));
  return (
    <Card labelledBy="scroll-title">
      <CardHeader id="scroll-title" icon={ArrowDownToLine} title={t("pages.scroll")} />
      {depth === null ? (
        <p className="text-muted">{t("pages.scrollOff")}</p>
      ) : (
        <ShareBars rows={rows} />
      )}
    </Card>
  );
}
