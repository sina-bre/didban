import type { OrganizationListResponse, ProjectListResponse } from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import type { SwitcherOrg } from "../../shared/components";
import { api } from "../../shared/lib/api-client";

/**
 * Organizations with the projects the user can open, for the two-level switcher. Both lists are
 * filtered by the server (spec §13.4); an organization without an accessible project is left out.
 */
export function groupProjects(
  orgs: OrganizationListResponse["organizations"],
  projects: ProjectListResponse["projects"],
): SwitcherOrg[] {
  return orgs
    .map((org) => ({
      id: org.id,
      name: org.name,
      projects: projects.filter((p) => p.organizationId === org.id),
    }))
    .filter((org) => org.projects.length > 0);
}

export function useSwitcherOrgs() {
  return useQuery({
    queryKey: ["switcher"],
    queryFn: async ({ signal }) => {
      const [orgs, projects] = await Promise.all([
        api<OrganizationListResponse>("/organizations", { signal }),
        api<ProjectListResponse>("/projects", { signal }),
      ]);
      return groupProjects(orgs.organizations, projects.projects);
    },
  });
}
