import { useParams, useSearchParams } from "react-router";
import { findSection } from "../../app/sections";
import { formatDateRange } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { rangeBounds, rangeDays, readRange } from "../../shared/lib/url-state";
import { NotFoundPage } from "../not-found/page";

/** Report frame: title and the active date range. The report bodies arrive in Stage 5c/5d. */
export function ReportPage() {
  const { t, locale } = useLocale();
  const [params] = useSearchParams();
  const section = findSection(useParams().section);
  if (!section) return <NotFoundPage />;
  const range = readRange(params);
  const { from, to } = rangeBounds(range);
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <h1 className="text-heading font-semibold">{t(section.label)}</h1>
      <p className="text-muted" data-testid="range">
        {range === "today" ? t("range.today") : t("range.lastDays", { count: rangeDays(range) })}
        {" · "}
        <bdi className="tabular-nums">{formatDateRange(locale, from, to)}</bdi>
      </p>
    </header>
  );
}
