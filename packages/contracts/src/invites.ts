import { z } from "zod";
import { emailSchema, PASSWORD_LIMITS } from "./auth.js";
import { orgRoleSchema } from "./organizations.js";

// Spec §11 invites. The token travels in the URL fragment (`/accept-invite#<token>`), so it never
// reaches server logs or Referer headers; the dashboard reads it and POSTs it (ADR 0023).

export const INVITE_TTL_HOURS = 72;
export const MAX_OPEN_INVITES_PER_ORGANIZATION = 100;

export const createInviteRequestSchema = z.object({ email: emailSchema, role: orgRoleSchema });
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

/** Platform admins invite an organization's owner only. */
export const createOwnerInviteRequestSchema = z.object({ email: emailSchema });
export type CreateOwnerInviteRequest = z.infer<typeof createOwnerInviteRequestSchema>;

export const inviteStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);

export const inviteSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: orgRoleSchema,
  status: inviteStatusSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type Invite = z.infer<typeof inviteSchema>;

/** The only response with the link. Only the token's hash is stored, so it is shown once. */
export const createdInviteSchema = inviteSchema.extend({ acceptUrl: z.url() });
export type CreatedInvite = z.infer<typeof createdInviteSchema>;

export const inviteListResponseSchema = z.object({ invites: z.array(inviteSchema) });
export type InviteListResponse = z.infer<typeof inviteListResponseSchema>;

const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const previewInviteRequestSchema = z.object({ token: inviteToken });
export type PreviewInviteRequest = z.infer<typeof previewInviteRequestSchema>;

/** Tells the dashboard whether to ask for a new password or the existing one. */
export const invitePreviewSchema = z.object({
  organizationName: z.string(),
  email: z.string(),
  role: orgRoleSchema,
  accountExists: z.boolean(),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;

/** New account: the password to set. Existing account: its current password (proof of ownership). */
export const acceptInviteRequestSchema = z.object({
  token: inviteToken,
  password: z.string().min(1).max(PASSWORD_LIMITS.max),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
