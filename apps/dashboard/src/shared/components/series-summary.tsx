import { formatNumber } from "../lib/format";
import { useLocale } from "../lib/locale-context";

export interface SeriesTotal {
  label: string;
  value: number;
}

const MARKERS = ["before:bg-series-1", "before:bg-series-2", "before:bg-series-3"] as const;
// The series marker is a pseudo-element: a `dl` group may hold only `dt` and `dd` (axe dlitem).
const MARKER =
  "relative ps-2.75 before:absolute before:start-0 before:top-1/2 before:h-8 before:w-0.75 before:-translate-y-1/2 before:rounded-pill";

/** Footer row under a chart: one total per series in the range (max 3), with its marker. */
export function SeriesSummary({ items }: { items: readonly SeriesTotal[] }) {
  const { locale } = useLocale();
  return (
    <dl className="grid grid-cols-1 gap-3 border-t border-dashed border-line pt-4 sm:grid-cols-3">
      {items.slice(0, 3).map((item, index) => (
        <div key={item.label} className={`${MARKER} ${MARKERS[index]}`}>
          <dt className="text-caption text-muted">{item.label}</dt>
          <dd className="text-title font-semibold tabular-nums">
            <bdi>{formatNumber(locale, item.value)}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}
