import type {
  AdminInstanceResponse,
  AdminOrganizationListResponse,
  AuditLogResponse,
} from "@didban/contracts";
import { ORG, PROJECT } from "./fixtures";

// Audit log pages and platform admin answers (Stage 5e).
const AT = "2026-10-20T10:00:00.000Z";

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
