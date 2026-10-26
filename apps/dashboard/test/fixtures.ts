import type {
  MeResponse,
  OrganizationListResponse,
  Project,
  ProjectListResponse,
} from "@didban/contracts";
import { channels, overview, realtime, timeseries } from "./stats-fixtures";

// API answers in the contract shapes, for page tests (fetch is stubbed by fake-api.ts).
export const ORG = "00000000-0000-4000-8000-000000000001";
export const PROJECT = "00000000-0000-4000-8000-0000000000a1";
export const OTHER = "00000000-0000-4000-8000-0000000000a2";

export const me = (mustChangePassword = false): MeResponse => ({
  user: {
    id: "00000000-0000-4000-8000-0000000000f1",
    email: "owner@example.com",
    isPlatformAdmin: false,
    mustChangePassword,
  },
});

export const orgs: OrganizationListResponse = {
  organizations: [{ id: ORG, name: "Acme", slug: "acme", role: "owner" }],
};

export const projects: ProjectListResponse = {
  projects: [
    { id: PROJECT, organizationId: ORG, name: "Shop", slug: "shop", role: null },
    { id: OTHER, organizationId: ORG, name: "Blog", slug: "blog", role: null },
  ],
};

export const project = (id = PROJECT): Project => ({
  id,
  organizationId: ORG,
  name: "Shop",
  slug: "shop",
  reportingTimezone: "UTC",
  sessionTimeoutMinutes: 30,
  retentionDays: null,
  allowIdentify: false,
  piiGuard: "strip",
  urlParamAllowlist: [],
  trailingSlashPolicy: "strip",
  hashRouting: false,
  storeCity: false,
  siteSearchParams: [],
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

/** A signed-in owner of one org with two projects, and data for every report. */
export const signedIn = () => ({
  "GET /auth/me": me(),
  "GET /organizations": orgs,
  "GET /projects": projects,
  [`GET /projects/${PROJECT}`]: project(),
  [`GET /projects/${OTHER}`]: project(OTHER),
  [`GET /projects/${PROJECT}/stats/overview`]: overview,
  [`GET /projects/${PROJECT}/stats/timeseries`]: timeseries,
  [`GET /projects/${PROJECT}/stats/sources`]: channels,
  [`GET /projects/${PROJECT}/stats/realtime`]: realtime,
});
