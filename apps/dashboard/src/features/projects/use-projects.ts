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

/** Both lists in one request pair; `canManage`: the user is owner or admin of some organization. */
function useProjectLists<T>(select: (lists: ProjectLists) => T) {
  return useQuery({
    queryKey: ["switcher"],
    queryFn: async ({ signal }): Promise<ProjectLists> => {
      const [orgs, projects] = await Promise.all([
        api<OrganizationListResponse>("/organizations", { signal }),
        api<ProjectListResponse>("/projects", { signal }),
      ]);
      const admin = new Set(orgs.organizations.filter((o) => o.role !== "member").map((o) => o.id));
      return {
        orgs: groupProjects(orgs.organizations, projects.projects),
        allOrgs: orgs.organizations,
        canManage: admin.size > 0,
        // Spec §11: org owner/admin, or project admin of that project.
        manageable: projects.projects
          .filter((p) => admin.has(p.organizationId) || p.role === "project_admin")
          .map((p) => p.id),
      };
    },
    select,
  });
}

interface ProjectLists {
  orgs: SwitcherOrg[];
  /** Every organization of the user with their role, also those without a project. */
  allOrgs: OrganizationListResponse["organizations"];
  canManage: boolean;
  /** Projects the user may manage (goals, settings). Only hides controls: the API decides. */
  manageable: string[];
}

const pickOrgs = (lists: ProjectLists) => lists.orgs;
const pickAll = (lists: ProjectLists) => lists;

export const useSwitcherOrgs = () => useProjectLists(pickOrgs);
export const useProjectsHome = () => useProjectLists(pickAll);

/** Whether the user may manage this project (goals, settings). */
export const useCanManage = (projectId: string) =>
  useProjectLists((lists) => lists.manageable.includes(projectId)).data ?? false;

/** `undefined` while loading, so pages do not flash a "no access" state. */
export const useManageAccess = (projectId: string) =>
  useProjectLists((lists) => lists.manageable.includes(projectId)).data;

/** The user's role in an organization; `null` when not a member, `undefined` while loading. */
export const useOrgRole = (organizationId: string | undefined) =>
  useProjectLists((lists) => lists.allOrgs.find((o) => o.id === organizationId)?.role ?? null).data;

/** Every organization of the user with their role; `undefined` while loading. */
export const useOrganizations = () => useProjectLists((lists) => lists.allOrgs).data;

/** Organizations where the user is owner or admin (create projects and users there). */
export const useAdminOrgs = () =>
  useProjectLists((lists) => lists.allOrgs.filter((o) => o.role !== "member")).data;
