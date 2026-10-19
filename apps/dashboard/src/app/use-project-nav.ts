import { useLocation, useMatch } from "react-router";
import { findSection, type Section, sectionHref } from "./sections";

export interface ProjectNav {
  current: Section | undefined;
  href: (section: Section) => string;
}

/** Navigation for the open project, or `null` outside a project (no report links then). */
export function useProjectNav(): ProjectNav | null {
  const match = useMatch("/projects/:projectId/:section?");
  const { search } = useLocation();
  const projectId = match?.params.projectId;
  if (!projectId) return null;
  return {
    current: findSection(match.params.section),
    href: (section) => sectionHref(projectId, section, search),
  };
}
