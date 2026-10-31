import { useParams } from "react-router";
import { NotFoundPage } from "../not-found/page";
import { useProject } from "../projects/use-project";
import { useOrgRole } from "../projects/use-projects";
import { AuditLog } from "./audit-log";

/** `/projects/:id/settings/audit`: the organization's log, this project's entries only. */
export function ProjectAuditPage() {
  const projectId = useParams().projectId ?? "";
  const project = useProject(projectId).data;
  const role = useOrgRole(project?.organizationId);
  if (!project || role === undefined) return null;
  // `org:audit` is owners and admins; the tab is hidden for others, a typed URL is not found.
  if (role !== "owner" && role !== "admin") return <NotFoundPage />;
  return <AuditLog organizationId={project.organizationId} projectId={projectId} />;
}
