import { FolderOpen } from "lucide-react";
import { Link, Navigate } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Skeleton, StatePanel } from "../../shared/ui";
import { QueryFailure } from "../report/query-failure";
import { useProjectsHome } from "./use-projects";

/** `/`: opens the first accessible project; with none, says why (and how to create one). */
export function HomePage() {
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
      <StatePanel icon={FolderOpen} title={t(`${key}.title`)} body={t(`${key}.body`)}>
        {home.data.canManage && (
          <Link to="/projects/new" className="font-medium text-accent-text underline">
            {t("menu.newProject")}
          </Link>
        )}
      </StatePanel>
    </Card>
  );
}
