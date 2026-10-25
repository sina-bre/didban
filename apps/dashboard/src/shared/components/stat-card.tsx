import { formatNumber, formatPercent } from "../lib/format";
import { useLocale } from "../lib/locale-context";
import { DeltaBadge } from "../ui";

interface Props {
  label: string;
  value: number;
  /** Relative change vs the previous period; `undefined` when comparison is off. */
  delta?: number | null;
  /** Hero variant: display-size number from `lg` (Overview primary KPI). */
  hero?: boolean;
}

/** Big confident number with a muted label under it; compact digits below `md` (design §4). */
export function StatCard({ label, value, delta, hero = false }: Props) {
  const { t, locale } = useLocale();
  const size = hero ? "text-metric lg:text-display" : "text-metric";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${size} font-semibold tabular-nums`}>
          <bdi className="md:hidden">{formatNumber(locale, value, true)}</bdi>
          <bdi className="hidden md:inline">{formatNumber(locale, value)}</bdi>
        </p>
        {delta !== undefined && (
          <DeltaBadge
            value={delta}
            text={delta === null ? "" : formatPercent(locale, delta, true)}
            nullHint={t("delta.none")}
          />
        )}
      </div>
      <p className="text-body text-muted">{label}</p>
    </div>
  );
}
