import { useLocation, useMatch } from "react-router";
import { findSection, type Section, sectionHref } from "./sections";

export interface ProjectNav {
  current: Section | undefined;
  href: (section: Section) => string;
}

/** Navigation for the open project, or `null` outside a project (no report links then). */
export function useProjectNav(): ProjectNav | null {
  // `/*`: a report's sub-page (`pages/detail`) still belongs to its section.
  const inSection = useMatch("/projects/:projectId/:section/*");
  const match = useMatch("/projects/:projectId") ?? inSection;
  const { search } = useLocation();
  const projectId = match?.params.projectId;
  if (!projectId) return null;
  return {
    current: findSection(inSection?.params.section),
    href: (section) => sectionHref(projectId, section, search),
  };
}
