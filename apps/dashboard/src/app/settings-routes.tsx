import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";

// Stage 5e routes (spec §13.3): project settings, organization settings, platform admin, the
// onboarding wizard and the public share view. Every page is its own lazy chunk.
const lazy = (
  path: string,
  load: () => Promise<ComponentType>,
  children?: RouteObject[],
): RouteObject => ({ path, lazy: { Component: load }, ...(children ? { children } : {}) });

const first = (to: string): RouteObject => ({ index: true, element: <Navigate to={to} replace /> });

/** Under `projects/:projectId`. */
export const projectSettings = lazy(
  "settings",
  async () => (await import("../features/settings/settings-layout")).SettingsLayout,
  [
    first("general"),
    lazy(
      "general",
      async () => (await import("../features/settings/general-page")).GeneralSettingsPage,
    ),
    lazy(
      "environments",
      async () => (await import("../features/environments/page")).EnvironmentsPage,
    ),
    lazy("keys", async () => (await import("../features/keys/page")).KeysPage),
    lazy("routes", async () => (await import("../features/routes/page")).RoutesPage),
    lazy(
      "members",
      async () => (await import("../features/members/project-members-page")).ProjectMembersPage,
    ),
    lazy("sharing", async () => (await import("../features/sharing/page")).SharingPage),
    lazy("data", async () => (await import("../features/settings/data-page")).DataSettingsPage),
    lazy(
      "audit",
      async () => (await import("../features/audit/project-audit-page")).ProjectAuditPage,
    ),
  ],
);

/** Signed-in pages inside the app shell. */
export const accountRoutes: RouteObject[] = [
  lazy("projects/new", async () => (await import("../features/onboarding/page")).OnboardingPage),
  lazy(
    "organizations/:organizationId/settings",
    async () => (await import("../features/organization/org-layout")).OrgSettingsLayout,
    [
      first("members"),
      lazy(
        "members",
        async () => (await import("../features/organization/members-page")).OrgMembersPage,
      ),
      lazy(
        "projects",
        async () => (await import("../features/organization/projects-page")).OrgProjectsPage,
      ),
      lazy("audit", async () => (await import("../features/organization/audit-page")).OrgAuditPage),
    ],
  ),
  lazy("admin", async () => (await import("../features/admin/admin-layout")).AdminLayout, [
    first("organizations"),
    lazy(
      "organizations",
      async () => (await import("../features/admin/organizations-page")).AdminOrganizationsPage,
    ),
    lazy("users", async () => (await import("../features/admin/users-page")).AdminUsersPage),
    lazy(
      "instance",
      async () => (await import("../features/admin/instance-page")).AdminInstancePage,
    ),
  ]),
];

/** Public: no session, no shell (`/share#<token>`). */
export const shareRoute = lazy(
  "share",
  async () => (await import("../features/share/page")).SharePage,
);
