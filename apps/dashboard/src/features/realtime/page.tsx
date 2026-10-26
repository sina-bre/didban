import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { useProject } from "../projects/use-project";
import { QueryBlock } from "../report/query-block";
import { ActiveCard } from "./active-card";
import { RecentEvents } from "./recent-events";
import { TopLists } from "./top-lists";
import { useRealtime } from "./use-realtime";

/** Realtime (spec §3.1): last 30 minutes, active visitors in the last 5, polled every 10 s. */
export function RealtimePage() {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const timeZone = useProject(projectId).data?.reportingTimezone ?? "UTC";
  const live = useRealtime(projectId);
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5" aria-busy={live.isPending}>
      <h1 className="py-2 text-heading font-semibold">{t("nav.realtime")}</h1>
      <QueryBlock query={live} skeleton="h-72">
        {(data) => (
          <>
            <ActiveCard data={data} timeZone={timeZone} />
            <TopLists data={data} />
            <RecentEvents events={data.recentEvents} timeZone={timeZone} />
          </>
        )}
      </QueryBlock>
    </div>
  );
}
