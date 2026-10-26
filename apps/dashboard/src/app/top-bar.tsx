import { useLocale } from "../shared/lib/locale-context";
import { PillNav } from "../shared/ui/pill-nav";
import { LocaleSwitch } from "./locale-switch";
import { ProjectSwitcher } from "./project-switcher";
import { SECTIONS } from "./sections";
import { useProjectNav } from "./use-project-nav";

/** Wordmark + (desktop) pill nav + utility buttons (design system §2). */
export function TopBar() {
  const { t } = useLocale();
  const nav = useProjectNav();
  return (
    <header className="mx-auto flex max-w-content items-center gap-4 px-4 py-3 md:px-5 lg:px-6">
      <span className="flex shrink-0 items-center gap-2 text-heading font-semibold">
        <span aria-hidden="true" className="size-2.5 rounded-pill bg-accent" />
        {/* Mobile top bar = switcher + buttons (design system §2): the name yields its room. */}
        <span className={nav ? "hidden md:inline" : undefined}>{t("app.name")}</span>
      </span>
      <ProjectSwitcher />
      <div className="hidden min-w-0 flex-1 justify-center lg:flex">
        {nav && (
          <PillNav
            label={t("nav.label")}
            items={SECTIONS.map((section) => ({ to: nav.href(section), label: t(section.label) }))}
          />
        )}
      </div>
      <div className="ms-auto shrink-0 lg:ms-0">
        <LocaleSwitch />
      </div>
    </header>
  );
}
