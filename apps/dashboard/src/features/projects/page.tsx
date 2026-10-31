import { FolderOpen } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Skeleton, StatePanel } from "../../shared/ui";
import { QueryFailure } from "../report/query-failure";
import { OrgCard } from "./org-card";
import { useProjectsHome } from "./use-projects";

/**
 * `/projects` (spec §13.3): the user's projects grouped by organization, as the server lists them.
 * Owners and admins also see their organizations without projects (to create the first one).
 */
export function ProjectsPage() {
  const { t } = useLocale();
  const home = useProjectsHome();
  if (home.isPending) return <Skeleton className="mt-4 h-40" />;
  if (home.isError) return <QueryFailure query={home} />;
  const { allOrgs, orgs } = home.data;
  const shown = allOrgs.filter((o) => o.role !== "member" || orgs.some((g) => g.id === o.id));
  if (shown.length === 0) {
    return (
      <Card className="mt-4">
        <StatePanel
          icon={FolderOpen}
          title={t("projects.none.title")}
          body={t("projects.none.body")}
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3 py-2 md:gap-4 lg:gap-5">
      <h1 className="text-heading font-semibold">{t("projects.title")}</h1>
      {shown.map((org) => (
        <OrgCard
          key={org.id}
          org={org}
          projects={orgs.find((g) => g.id === org.id)?.projects ?? []}
          admin={org.role !== "member"}
        />
      ))}
    </div>
  );
}
