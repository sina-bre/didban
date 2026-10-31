import { Link2Off } from "lucide-react";
import { LocaleSwitch } from "../../app/locale-switch";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Segmented, Skeleton, StatePanel } from "../../shared/ui";
import { DevicesPage } from "../devices/page";
import { GeoPage } from "../geo/page";
import { OverviewPage } from "../overview/page";
import { StatsSourceContext } from "../report/stats-source";
import { useUrlChoice } from "../report/use-url-choice";
import { SourcesPage } from "../sources/page";
import { useSharedProject } from "./use-shared-project";

const VIEWS = ["overview", "sources", "geo", "devices"] as const;
const PAGES = { overview: OverviewPage, sources: SourcesPage, geo: GeoPage, devices: DevicesPage };
const LABELS = {
  overview: "nav.overview",
  sources: "nav.sources",
  geo: "nav.geo",
  devices: "nav.devices",
} as const;

/**
 * `/share#<token>` (spec §13.3): the same report components, read-only, no session and no
 * management UI. A wrong, revoked or expired link looks like a missing one.
 */
export function SharePage() {
  const { t } = useLocale();
  const { token, info, source } = useSharedProject();
  const [view, setView] = useUrlChoice("report", VIEWS);
  const Report = PAGES[view];
  let body = <Skeleton className="mt-4 h-40" />;
  if (!token || info.isError) {
    body = (
      <Card className="mt-4">
        <StatePanel
          icon={Link2Off}
          title={t("shareView.missing.title")}
          body={t("shareView.missing.body")}
        />
      </Card>
    );
  } else if (source && info.data) {
    body = (
      <StatsSourceContext value={source}>
        <p className="text-muted">
          {info.data.projectName} · {info.data.label}
        </p>
        <Segmented
          label={t("nav.label")}
          value={view}
          options={VIEWS.map((v) => ({ value: v, label: t(LABELS[v]) }))}
          onChange={setView}
        />
        <Report />
      </StatsSourceContext>
    );
  }
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-content items-center gap-4 px-4 py-3 md:px-5 lg:px-6">
        <span className="flex items-center gap-2 text-heading font-semibold">
          <span aria-hidden="true" className="size-2.5 rounded-pill bg-accent" />
          {t("app.name")}
        </span>
        <span className="text-muted">{t("shareView.readOnly")}</span>
        <div className="ms-auto">
          <LocaleSwitch />
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex max-w-content flex-col gap-3 px-4 pb-10 md:px-5 lg:px-6"
      >
        {body}
      </main>
    </div>
  );
}
