// Spec §11 platform admin pages: instance health and per-organization usage counts. A platform
// admin who is not a member still reads no project or analytics data; these are counts only.

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: string | null;
  createdAt: string;
  members: number;
  projects: number;
  /** Accepted events over the last 30 UTC days, all projects (`project_usage_daily`). */
  eventsLast30Days: number;
  dailyEventQuota: number | null;
};
export type AdminOrganizationListResponse = { organizations: AdminOrganization[] };

export type AdminUser = {
  id: string;
  email: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  organizations: number;
  createdAt: string;
};
export type AdminUserListResponse = { users: AdminUser[] };

export type AdminInstanceResponse = {
  node: string;
  postgres: string;
  uptimeSeconds: number;
  databaseBytes: number;
  geoIp: boolean;
  counts: { organizations: number; users: number; projects: number; eventsToday: number };
};
