import { useMatch, useNavigate } from "react-router";
import { useMe } from "../features/auth/use-me";
import { useProject } from "../features/projects/use-project";
import { useAdminOrgs, useCanManage } from "../features/projects/use-projects";
import { useLocale } from "../shared/lib/locale-context";
import { Menu, type MenuItem } from "../shared/ui";

/**
 * The way to everything that is not a report: all projects, this project's settings, a new
 * project, organization settings, platform admin. Items the user cannot use are left out (the
 * API decides; this only hides).
 */
export function SettingsMenu() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const projectId = useMatch("/projects/:projectId/*")?.params.projectId ?? "";
  const inProject = projectId !== "" && projectId !== "new";
  const project = useProject(inProject ? projectId : "").data;
  const canManage = useCanManage(projectId);
  const adminOrgs = useAdminOrgs() ?? [];
  const isPlatformAdmin = useMe().data?.user.isPlatformAdmin ?? false;
  const org = adminOrgs.find((o) => o.id === project?.organizationId) ?? adminOrgs[0];
  const targets: (MenuItem & { to: string; show: boolean })[] = [
    { id: "projects", label: t("menu.projects"), to: "/projects", show: true },
    {
      id: "settings",
      label: t("menu.projectSettings"),
      to: `/projects/${projectId}/settings/general`,
      show: inProject && canManage,
    },
    { id: "new", label: t("menu.newProject"), to: "/projects/new", show: adminOrgs.length > 0 },
    {
      id: "org",
      label: t("menu.orgSettings"),
      to: `/organizations/${org?.id}/settings/members`,
      show: org !== undefined,
    },
    { id: "admin", label: t("menu.admin"), to: "/admin/organizations", show: isPlatformAdmin },
  ];
  const items = targets.filter((item) => item.show);
  return (
    <Menu
      label={t("menu.label")}
      items={items}
      onSelect={(id) => void navigate(items.find((item) => item.id === id)?.to ?? "/projects")}
    />
  );
}
