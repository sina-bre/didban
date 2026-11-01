import { lazy, Suspense, useRef } from "react";
import { useInView } from "../lib/use-in-view";
import { Skeleton } from "../ui";
import type { PlotProps } from "./time-series-plot";

const TimeSeriesPlot = lazy(() => import("./time-series-plot"));

/**
 * The Recharts plot, fetched once its place scrolls into view (Lighthouse mobile, Stage 5f: on a
 * phone the chart sits below the fold and its 105 KB chunk delayed the first screen's data).
 */
export function LazyPlot(props: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const placeholder = <Skeleton className="h-64" />;
  return (
    <div ref={ref}>
      {inView ? (
        <Suspense fallback={placeholder}>
          <TimeSeriesPlot {...props} />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
