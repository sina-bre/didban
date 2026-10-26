import { FolderOpen } from "lucide-react";
import { Navigate } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Skeleton, StatePanel } from "../../shared/ui";
import { QueryFailure } from "../report/query-failure";
import { useProjectsHome } from "./use-projects";

/** `/projects`: opens the first accessible project; the full list page comes with onboarding. */
export function ProjectsPage() {
  const { t } = useLocale();
  const home = useProjectsHome();
  if (home.isPending) return <Skeleton className="mt-4 h-40" />;
  if (home.isError) return <QueryFailure query={home} />;
  const first = home.data.orgs[0]?.projects[0];
  if (first) return <Navigate to={`/projects/${first.id}/overview`} replace />;
  // An owner/admin sees every project of their org, so an empty list means the org has none.
  const key = home.data.canManage ? "projects.empty" : "projects.none";
  return (
    <Card className="mt-4">
      <StatePanel icon={FolderOpen} title={t(`${key}.title`)} body={t(`${key}.body`)} />
    </Card>
  );
}
