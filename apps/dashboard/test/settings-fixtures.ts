import type {
  ApiKeyListResponse,
  Environment,
  OrganizationMemberListResponse,
  ProjectMemberListResponse,
  RouteTemplateListResponse,
  ShareLinkListResponse,
} from "@didban/contracts";
import { adminOrgs, auditPages, instance } from "./admin-fixtures";
import { ORG, PROJECT } from "./fixtures";

// Stage 5e API answers in the contract shapes (settings, members, audit, admin).
export const ENV = "00000000-0000-4000-8000-0000000000e1";
export const MEMBER = "00000000-0000-4000-8000-0000000000f2";
export const AT = "2026-10-20T10:00:00.000Z";
const P = `/projects/${PROJECT}`;
const O = `/organizations/${ORG}`;

export const environment: Environment = {
  id: ENV,
  projectId: PROJECT,
  name: "production",
  identityMode: "cookieless",
  allowedOrigins: ["https://shop.example"],
  excludedCidrs: [],
  trackLocalhost: false,
  createdAt: AT,
};

export const keys: ApiKeyListResponse = {
  keys: [
    {
      id: "00000000-0000-4000-8000-0000000000c1",
      environmentId: ENV,
      kind: "write_browser",
      prefix: "dpk_0123456789ab",
      createdAt: AT,
      lastUsedAt: null,
      revokedAt: null,
    },
  ],
};

export const routes: RouteTemplateListResponse = {
  routes: [
    {
      id: "00000000-0000-4000-8000-0000000000d1",
      position: 1,
      pattern: "/products/:id",
      createdAt: AT,
    },
  ],
};

export const shares: ShareLinkListResponse = {
  shareLinks: [
    {
      id: "00000000-0000-4000-8000-0000000000b1",
      label: "Board",
      createdAt: AT,
      expiresAt: null,
      revokedAt: null,
    },
  ],
};

export const projectMembers: ProjectMemberListResponse = {
  members: [],
  candidates: [{ userId: MEMBER, email: "m@example.com" }],
};

export const orgMembers: OrganizationMemberListResponse = {
  members: [
    {
      userId: "00000000-0000-4000-8000-0000000000f1",
      email: "owner@example.com",
      role: "owner",
      mustChangePassword: false,
      joinedAt: AT,
    },
    {
      userId: MEMBER,
      email: "m@example.com",
      role: "member",
      mustChangePassword: true,
      joinedAt: AT,
    },
  ],
};

/** Every 5e list route of the signed-in owner's project and organization. */
export const settingsApi = () => ({
  [`GET ${P}/environments`]: { environments: [environment] },
  [`GET ${P}/keys`]: keys,
  [`GET ${P}/routes`]: routes,
  [`GET ${P}/shares`]: shares,
  [`GET ${P}/members`]: projectMembers,
  [`GET ${O}/members`]: orgMembers,
  [`GET ${O}/projects`]: {
    projects: [{ id: PROJECT, name: "Shop", slug: "shop", archivedAt: null }],
  },
  [`GET ${O}/audit-log`]: (url: URL) => ({
    body: auditPages[url.searchParams.get("before") ?? "first"],
  }),
  "GET /admin/organizations": adminOrgs,
  "GET /admin/users": { users: [] },
  "GET /admin/instance": instance,
});
