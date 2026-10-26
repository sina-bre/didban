import { Outlet, useParams } from "react-router";
import { NotFoundPage } from "../features/not-found/page";
import { useProject } from "../features/projects/use-project";
import { QueryFailure } from "../features/report/query-failure";
import { ApiError } from "../shared/lib/api-client";
import { Skeleton } from "../shared/ui";

/** `/projects/:projectId/*`: loads the project once; a missing or forbidden one is not found. */
export function ProjectLayout() {
  const project = useProject(useParams().projectId ?? "");
  if (project.isPending) return <Skeleton className="mt-4 h-40" />;
  if (project.isError) {
    const missing = project.error instanceof ApiError && project.error.status === 404;
    return missing ? <NotFoundPage /> : <QueryFailure query={project} />;
  }
  return <Outlet />;
}
