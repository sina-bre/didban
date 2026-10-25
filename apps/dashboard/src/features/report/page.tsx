import { useParams, useSearchParams } from "react-router";
import { findSection } from "../../app/sections";
import { DateRangePicker } from "../../shared/components";
import { formatDateRange } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import {
  customBounds,
  rangeBounds,
  rangeDays,
  readCustomRange,
  readRange,
} from "../../shared/lib/url-state";
import { NotFoundPage } from "../not-found/page";

/** Report frame: title, the range picker and the active range. Bodies arrive in Stage 5c/5d. */
export function ReportPage() {
  const { t, locale } = useLocale();
  const [params] = useSearchParams();
  const section = findSection(useParams().section);
  if (!section) return <NotFoundPage />;
  const custom = readCustomRange(params);
  const range = readRange(params);
  const { from, to } = custom ? customBounds(custom) : rangeBounds(range);
  const label = custom
    ? t("range.custom")
    : range === "today"
      ? t("range.today")
      : t("range.lastDays", { count: rangeDays(range) });
  return (
    <header className="flex flex-col gap-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-heading font-semibold">{t(section.label)}</h1>
        <p className="text-muted" data-testid="range">
          {label}
          {" · "}
          <bdi className="tabular-nums">{formatDateRange(locale, from, to)}</bdi>
        </p>
      </div>
      <DateRangePicker />
    </header>
  );
}
