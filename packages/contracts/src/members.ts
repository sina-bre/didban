import type { z } from "zod";
import type { orgRoleSchema, projectRoleSchema } from "./organizations.js";

// Spec §11 member lists for the settings pages. Emails only: no password or session data.

/** `GET /organizations/:id/members` (owners and admins). */
export type OrganizationMember = {
  userId: string;
  email: string;
  role: z.infer<typeof orgRoleSchema>;
  /** Still on the one-time temporary password (ADR 0024). */
  mustChangePassword: boolean;
  joinedAt: string;
};
export type OrganizationMemberListResponse = { members: OrganizationMember[] };

/**
 * `GET /projects/:id/members`: who has a project role, and the org `member`s who could get one.
 * Org owners and admins reach every project already, so they are in neither list.
 */
export type ProjectMemberListResponse = {
  members: { userId: string; email: string; role: z.infer<typeof projectRoleSchema> }[];
  candidates: { userId: string; email: string }[];
};
