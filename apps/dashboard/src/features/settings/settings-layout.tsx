import { Outlet, useParams } from "react-router";
import { PermissionDenied } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Skeleton } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { useManageAccess, useOrgRole } from "../projects/use-projects";
import { SettingsNav } from "./settings-nav";

const TABS = [
  { id: "general", label: "settings.general" },
  { id: "environments", label: "settings.environments" },
  { id: "keys", label: "settings.keys" },
  { id: "routes", label: "settings.routes" },
  { id: "members", label: "settings.members" },
  { id: "sharing", label: "settings.sharing" },
  { id: "data", label: "settings.data" },
] as const;
const AUDIT = { id: "audit", label: "settings.audit" } as const;

/**
 * `/projects/:id/settings/*` (spec §13.3) for project managers; a viewer sees the 403 state. The
 * audit tab reads the organization's log, so it is there for org owners and admins only.
 */
export function SettingsLayout() {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const project = useProject(projectId).data;
  const manage = useManageAccess(projectId);
  const role = useOrgRole(project?.organizationId);
  if (manage === undefined || role === undefined) return <Skeleton className="mt-4 h-40" />;
  if (!manage) {
    return (
      <Card className="mt-4">
        <PermissionDenied />
      </Card>
    );
  }
  const tabs = role === "owner" || role === "admin" ? [...TABS, AUDIT] : TABS;
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <header className="flex flex-col gap-3 py-2">
        <h1 className="text-heading font-semibold">
          {t("settings.title", { name: project?.name ?? "" })}
        </h1>
        <SettingsNav
          label={t("settings.nav")}
          base={`/projects/${projectId}/settings`}
          tabs={tabs}
        />
      </header>
      <Outlet />
    </div>
  );
}
