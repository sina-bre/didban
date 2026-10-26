import { useMatch } from "react-router";
import { useSwitcherOrgs } from "../features/projects/use-projects";
import { OrgProjectSwitcher } from "../shared/components";

/** The org → project switcher in the top bar, inside a project the user can open. */
export function ProjectSwitcher() {
  const projectId = useMatch("/projects/:projectId/*")?.params.projectId;
  const orgs = useSwitcherOrgs();
  const known = orgs.data?.some((org) => org.projects.some((p) => p.id === projectId));
  if (!projectId || !orgs.data || !known) return null;
  return <OrgProjectSwitcher orgs={orgs.data} currentProjectId={projectId} />;
}
