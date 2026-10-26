import { PAGE_VIEWS } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { Segmented } from "../../shared/ui";
import { ReportHeader } from "../report/report-header";
import { useUrlChoice } from "../report/use-url-choice";
import { DiscoveredPages } from "./discovered-pages";
import { EntryExitPages } from "./entry-exit-pages";
import { TopPages } from "./top-pages";

/** Pages (spec §3.1): top, entry, exit and discovered pages; a top page opens its detail. */
export function PagesPage() {
  const { t } = useLocale();
  const [view, setView] = useUrlChoice("view", PAGE_VIEWS);
  const options = PAGE_VIEWS.map((v) => ({ value: v, label: t(`pages.view.${v}`) }));
  const controls = (
    <Segmented label={t("pages.view")} value={view} options={options} onChange={setView} />
  );
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <ReportHeader title={t("nav.pages")} />
      {view === "top" && <TopPages controls={controls} />}
      {(view === "entry" || view === "exit") && <EntryExitPages view={view} controls={controls} />}
      {view === "discovered" && <DiscoveredPages controls={controls} />}
    </div>
  );
}
