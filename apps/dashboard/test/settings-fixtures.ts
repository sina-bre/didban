import type {
  AdminInstanceResponse,
  AdminOrganizationListResponse,
  ApiKeyListResponse,
  AuditLogResponse,
  Environment,
  OrganizationMemberListResponse,
  ProjectMemberListResponse,
  RouteTemplateListResponse,
  ShareLinkListResponse,
} from "@didban/contracts";
import { ORG, PROJECT } from "./fixtures";

// Stage 5e API answers in the contract shapes (settings, members, audit, admin).
export const ENV = "00000000-0000-4000-8000-0000000000e1";
export const MEMBER = "00000000-0000-4000-8000-0000000000f2";
const AT = "2026-10-20T10:00:00.000Z";
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

const entry = (id: string, action: AuditLogResponse["entries"][number]["action"]) => ({
  id,
  createdAt: AT,
  action,
  actor: { id: "00000000-0000-4000-8000-0000000000f1", email: "owner@example.com" },
  projectId: PROJECT,
  target: { type: "share_link" as const, id: "00000000-0000-4000-8000-0000000000b1" },
  details: { label: "Board" },
  requestId: null,
  ipPrefix: "203.0.113.0/24",
});

export const auditPages: Record<string, AuditLogResponse> = {
  first: { entries: [entry("12", "share_link.created")], nextBefore: "12" },
  "12": { entries: [entry("3", "api_key.revoked")], nextBefore: null },
};

export const adminOrgs: AdminOrganizationListResponse = {
  organizations: [
    {
      id: ORG,
      name: "Acme",
      slug: "acme",
      suspendedAt: null,
      createdAt: AT,
      members: 2,
      projects: 2,
      eventsLast30Days: 1234,
      dailyEventQuota: null,
    },
  ],
};

export const instance: AdminInstanceResponse = {
  node: "v24.18.0",
  postgres: "18.0",
  uptimeSeconds: 125,
  databaseBytes: 50 * 1024 * 1024,
  geoIp: false,
  counts: { organizations: 1, users: 2, projects: 2, eventsToday: 77 },
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
