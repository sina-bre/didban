import type { Ref } from "react";
import { NavLink } from "react-router";
import { useLocale } from "../shared/lib/locale-context";
import { Dialog } from "../shared/ui/dialog";
import type { Section } from "./sections";
import type { ProjectNav } from "./use-project-nav";

interface Props {
  ref: Ref<HTMLDialogElement>;
  sections: readonly Section[];
  nav: ProjectNav;
  onNavigate: () => void;
}

/** The reports that do not fit the tab bar. */
export function MoreSheet({ ref, sections, nav, onNavigate }: Props) {
  const { t } = useLocale();
  return (
    <Dialog ref={ref} title={t("more.title")} closeLabel={t("more.close")} placement="sheet">
      <ul className="grid gap-1">
        {sections.map((section) => (
          <li key={section.id}>
            <NavLink
              to={nav.href(section)}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-control px-3 hover:bg-subtle ${
                  isActive ? "bg-accent-soft font-medium text-accent-text" : ""
                }`
              }
            >
              <section.icon aria-hidden="true" className="size-5" />
              {t(section.label)}
            </NavLink>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
