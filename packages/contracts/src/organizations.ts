import { z } from "zod";

// Spec §11 roles. The server owns the rules; these are the wire shapes only.
export const orgRoleSchema = z.enum(["owner", "admin", "member"]);
export const projectRoleSchema = z.enum(["project_admin", "viewer"]);

export const changeMemberRoleRequestSchema = z.object({ role: orgRoleSchema });
export type ChangeMemberRoleRequest = z.infer<typeof changeMemberRoleRequestSchema>;

export const assignProjectMemberRequestSchema = z.object({ role: projectRoleSchema });
export type AssignProjectMemberRequest = z.infer<typeof assignProjectMemberRequestSchema>;

/** Platform admins only (spec §11). Name rules (1–100 chars after trim) are checked on the server. */
export const createOrganizationRequestSchema = z.object({ name: z.string().max(200) });
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const setOrganizationSuspendedRequestSchema = z.object({ suspended: z.boolean() });
export type SetOrganizationSuspendedRequest = z.infer<typeof setOrganizationSuspendedRequestSchema>;

export const organizationListResponseSchema = z.object({
  organizations: z.array(
    z.object({ id: z.uuid(), name: z.string(), slug: z.string(), role: orgRoleSchema }),
  ),
});
export type OrganizationListResponse = z.infer<typeof organizationListResponseSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(
    z.object({
      id: z.uuid(),
      organizationId: z.uuid(),
      name: z.string(),
      slug: z.string(),
      /** The caller's project role; `null` when access comes from being an org owner/admin. */
      role: projectRoleSchema.nullable(),
    }),
  ),
});
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
