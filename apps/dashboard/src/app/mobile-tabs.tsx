import { Ellipsis } from "lucide-react";
import { useRef } from "react";
import { useLocale } from "../shared/lib/locale-context";
import { TabBar } from "../shared/ui/tab-bar";
import { TabBarItem } from "../shared/ui/tab-bar-item";
import { MoreSheet } from "./more-sheet";
import { SECTIONS, TAB_COUNT } from "./sections";
import { useProjectNav } from "./use-project-nav";

const TABS = SECTIONS.slice(0, TAB_COUNT);
const MORE = SECTIONS.slice(TAB_COUNT);

/** Bottom tab bar below `lg`: four reports + "More" (a sheet with the rest). */
export function MobileTabs() {
  const { t } = useLocale();
  const nav = useProjectNav();
  const sheet = useRef<HTMLDialogElement>(null);
  if (!nav) return null;
  return (
    <>
      <TabBar label={t("nav.label")}>
        {TABS.map((section) => (
          <TabBarItem
            key={section.id}
            to={nav.href(section)}
            label={t(section.label)}
            icon={section.icon}
          />
        ))}
        <TabBarItem
          label={t("nav.more")}
          icon={Ellipsis}
          active={MORE.some((section) => section === nav.current)}
          onClick={() => sheet.current?.showModal()}
        />
      </TabBar>
      <MoreSheet ref={sheet} sections={MORE} nav={nav} onNavigate={() => sheet.current?.close()} />
    </>
  );
}
