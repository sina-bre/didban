import type { DataHealthResponse } from "@didban/contracts";
import { Activity } from "lucide-react";
import { formatDayHour, formatNumber } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";

interface Props {
  data: DataHealthResponse;
  timeZone: string;
}

/** Last event time, events in the window and the discovered-pages cap. */
export function HealthStatus({ data, timeZone }: Props) {
  const { t, locale } = useLocale();
  const total = data.eventsPerHour.reduce((sum, hour) => sum + hour.events, 0);
  const { count, cap, overflowing } = data.pagesSeen;
  return (
    <Card labelledBy="health-title">
      <CardHeader id="health-title" icon={Activity} title={t("health.status")} />
      <dl className="grid gap-x-4 gap-y-6 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-muted">{t("health.lastEvent")}</dt>
          <dd className="text-title font-medium tabular-nums" data-testid="last-event">
            {data.lastEventAt ? (
              <bdi>{formatDayHour(locale, new Date(data.lastEventAt), timeZone)}</bdi>
            ) : (
              t("health.never")
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-muted">{t("health.events")}</dt>
          <dd className="text-title font-medium tabular-nums">
            <bdi>{formatNumber(locale, total)}</bdi>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-muted">{t("health.pagesSeen")}</dt>
          <dd className="text-title font-medium tabular-nums">
            <bdi>
              {formatNumber(locale, count)} / {formatNumber(locale, cap)}
            </bdi>
          </dd>
        </div>
      </dl>
      {data.lastEventAt === null && (
        <p className="mt-4 text-body text-muted">{t("health.neverHint")}</p>
      )}
      {overflowing && (
        <p role="status" className="mt-4 text-body text-down">
          {t("health.overflowing")}
        </p>
      )}
    </Card>
  );
}
