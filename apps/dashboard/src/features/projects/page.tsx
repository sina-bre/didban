import { FolderOpen } from "lucide-react";
import { Navigate } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, Skeleton, StatePanel } from "../../shared/ui";
import { QueryFailure } from "../report/query-failure";
import { useSwitcherOrgs } from "./use-projects";

/** `/projects`: opens the first accessible project; the full list page comes with onboarding. */
export function ProjectsPage() {
  const { t } = useLocale();
  const orgs = useSwitcherOrgs();
  if (orgs.isPending) return <Skeleton className="mt-4 h-40" />;
  if (orgs.isError) return <QueryFailure query={orgs} />;
  const first = orgs.data[0]?.projects[0];
  if (first) return <Navigate to={`/projects/${first.id}/overview`} replace />;
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
