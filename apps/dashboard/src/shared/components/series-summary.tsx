import { formatNumber } from "../lib/format";
import { useLocale } from "../lib/locale-context";

export interface SeriesTotal {
  label: string;
  value: number;
}

const MARKERS = ["bg-series-1", "bg-series-2", "bg-series-3"] as const;

/** Footer row under a chart: one total per series in the range (max 3), with its marker. */
export function SeriesSummary({ items }: { items: readonly SeriesTotal[] }) {
  const { locale } = useLocale();
  return (
    <dl className="grid grid-cols-1 gap-3 border-t border-dashed border-line pt-4 sm:grid-cols-3">
      {items.slice(0, 3).map((item, index) => (
        <div key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-8 w-0.75 rounded-pill ${MARKERS[index]}`} />
          <div>
            <dt className="text-caption text-muted">{item.label}</dt>
            <dd className="text-title font-semibold tabular-nums">
              <bdi>{formatNumber(locale, item.value)}</bdi>
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
