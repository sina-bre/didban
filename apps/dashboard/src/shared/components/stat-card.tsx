import { formatDuration, formatNumber, formatPercent } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { useLocale } from "../lib/locale-context";
import { DeltaBadge } from "../ui";

type Kind = "count" | "percent" | "duration";

interface Props {
  label: string;
  /** `null` when there is nothing to divide by (spec §4): shown as "—". */
  value: number | null;
  /** A count (compact below `md`), a 0–1 rate, or seconds. */
  kind?: Kind;
  /** Relative change vs the previous period; `undefined` when comparison is off. */
  delta?: number | null;
  /** Hero variant: display-size number from `lg` (Overview primary KPI). */
  hero?: boolean;
}

function display(locale: Locale, kind: Kind, value: number, compact: boolean): string {
  if (kind === "percent") return formatPercent(locale, value);
  if (kind === "duration") return formatDuration(locale, value);
  return formatNumber(locale, value, compact);
}

/** Big confident number with a muted label under it; compact digits below `md` (design §4). */
export function StatCard({ label, value, kind = "count", delta, hero = false }: Props) {
  const { t, locale } = useLocale();
  const size = hero ? "text-metric lg:text-display" : "text-metric";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${size} font-semibold tabular-nums`}>
          {value === null ? (
            "—"
          ) : (
            <>
              <bdi className="md:hidden">{display(locale, kind, value, true)}</bdi>
              <bdi className="hidden md:inline">{display(locale, kind, value, false)}</bdi>
            </>
          )}
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
