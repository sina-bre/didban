import { formatNumber, formatPercent } from "../lib/format";
import { useLocale } from "../lib/locale-context";

export interface ShareRow {
  key: string;
  label: string;
  value: number;
  /** 0–1 of the total. */
  share: number;
}

/** Hatched bars with "% · count" (channels, devices, top sources). Bars are decorative. */
export function ShareBars({ rows }: { rows: readonly ShareRow[] }) {
  const { locale } = useLocale();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-body">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 text-muted tabular-nums">
              <bdi>{formatPercent(locale, row.share)}</bdi> ·{" "}
              <bdi>{formatNumber(locale, row.value)}</bdi>
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-subtle">
            <div
              className="hatch h-full rounded-pill bg-series-1"
              style={{ width: `${Math.min(1, Math.max(0, row.share)) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
