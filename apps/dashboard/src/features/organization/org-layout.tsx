import { Outlet, useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Skeleton } from "../../shared/ui";
import { NotFoundPage } from "../not-found/page";
import { useOrganizations } from "../projects/use-projects";
import { SettingsNav } from "../settings/settings-nav";

const TABS = [
  { id: "members", label: "org.members" },
  { id: "projects", label: "org.projects" },
  { id: "audit", label: "settings.audit" },
] as const;

/**
 * `/organizations/:id/settings/*` (spec §13.3) for owners and admins. Members of the org and
 * everyone else get "not found", like the API (the routes need `org:users` / `org:audit`).
 */
export function OrgSettingsLayout() {
  const { t } = useLocale();
  const organizationId = useParams().organizationId ?? "";
  const orgs = useOrganizations();
  if (orgs === undefined) return <Skeleton className="mt-4 h-40" />;
  const org = orgs.find((o) => o.id === organizationId);
  if (!org || org.role === "member") return <NotFoundPage />;
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <header className="flex flex-col gap-3 py-2">
        <h1 className="text-heading font-semibold">{t("org.title", { name: org.name })}</h1>
        <SettingsNav
          label={t("settings.nav")}
          base={`/organizations/${organizationId}/settings`}
          tabs={TABS}
        />
      </header>
      <Outlet />
    </div>
  );
}
