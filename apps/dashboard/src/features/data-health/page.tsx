import { useLocale } from "../../shared/lib/locale-context";
import { QueryBlock } from "../report/query-block";
import { EventsPerHour } from "./events-per-hour";
import { HealthStatus } from "./health-status";
import { RecentRejections } from "./recent-rejections";
import { Rejections } from "./rejections";
import { useDataHealth } from "./use-data-health";

/**
 * Data health (spec §3.1): how an operator debugs "I installed the SDK and see nothing". Last
 * event, events per hour, rejections by code and origin, the last rejected batches.
 */
export function DataHealthPage() {
  const { t } = useLocale();
  const { timeZone, health } = useDataHealth();
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5" aria-busy={health.isFetching}>
      <header className="py-2">
        <h1 className="text-heading font-semibold">{t("nav.dataHealth")}</h1>
        <p className="text-muted">{t("health.window")}</p>
      </header>
      <QueryBlock query={health} skeleton="h-96">
        {(data) => (
          <>
            <HealthStatus data={data} timeZone={timeZone} />
            <EventsPerHour points={data.eventsPerHour} timeZone={timeZone} />
            <Rejections data={data} timeZone={timeZone} />
            <RecentRejections rows={data.recentRejections} timeZone={timeZone} />
          </>
        )}
      </QueryBlock>
    </div>
  );
}
