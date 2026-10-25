import { ChevronsUpDown } from "lucide-react";
import { Link } from "react-router";
import { useLocale } from "../lib/locale-context";
import { useAnchor } from "../ui";

export interface SwitcherOrg {
  id: string;
  name: string;
  projects: readonly { id: string; name: string }[];
}

interface Props {
  /** Only the organizations and projects the user can access (filtered server-side, spec §13.4). */
  orgs: readonly SwitcherOrg[];
  currentProjectId: string;
}

/**
 * Two-level organization → project switcher: a disclosure popover (Popover API) with project
 * links grouped by organization. Links, not a menu: Tab moves through them, Escape closes.
 */
export function OrgProjectSwitcher({ orgs, currentProjectId }: Props) {
  const { t } = useLocale();
  const { id, trigger, popover } = useAnchor();
  const org = orgs.find((o) => o.projects.some((p) => p.id === currentProjectId));
  const project = org?.projects.find((p) => p.id === currentProjectId);
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={`${t("switcher.label")}: ${org?.name ?? ""} / ${project?.name ?? ""}`}
        style={trigger}
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-pill px-2 text-start hover:bg-subtle"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{project?.name}</span>
          <span className="truncate text-caption text-muted">{org?.name}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
      </button>
      <nav
        id={id}
        popover="auto"
        aria-label={t("switcher.label")}
        style={popover}
        className="pop-below max-h-96 w-72 overflow-auto rounded-panel bg-surface p-2 text-ink shadow-pop"
      >
        {orgs.map((o) => (
          <section key={o.id} aria-label={o.name} className="py-1">
            <h3 className="px-3 py-1 text-caption text-muted">{o.name}</h3>
            <ul>
              {o.projects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}/overview`}
                    aria-current={p.id === currentProjectId ? "page" : undefined}
                    onClick={() => document.getElementById(id)?.hidePopover()}
                    className="flex min-h-11 items-center rounded-control px-3 text-body hover:bg-subtle aria-[current=page]:bg-subtle aria-[current=page]:font-medium"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </>
  );
}
