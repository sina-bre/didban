import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
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

interface Props {
  title: string;
  /** Report-specific controls after the range picker (e.g. the compare switch). */
  children?: ReactNode;
}

/** Report title, the active range and the URL-bound range picker (spec §13.4). */
export function ReportHeader({ title, children }: Props) {
  const { t, locale } = useLocale();
  const [params] = useSearchParams();
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
        <h1 className="text-heading font-semibold">{title}</h1>
        <p className="text-muted" data-testid="range">
          {label}
          {" · "}
          <bdi className="tabular-nums">{formatDateRange(locale, from, to)}</bdi>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <DateRangePicker />
        {children}
      </div>
    </header>
  );
}
