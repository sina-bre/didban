import { z } from "zod";

// Spec §11 audit log. The dashboard labels these; the server writes nothing else.
export const AUDIT_ACTIONS = [
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.logout",
  "auth.sessions_revoked",
  "auth.password_changed",
  "user.platform_admin_granted",
  "user.platform_admin_revoked",
  "organization.created",
  "organization.suspended",
  "organization.unsuspended",
  "organization.member_role_changed",
  "organization.member_removed",
  "project.created",
  "project.updated",
  "project.archived",
  "project.restored",
  "project.member_assigned",
  "project.member_removed",
  "environment.created",
  "environment.updated",
  "api_key.created",
  "api_key.revoked",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  "user",
  "organization",
  "project",
  "environment",
  "api_key",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const AUDIT_PAGE_MAX = 100;

/** `before` is the `id` of the last entry already shown (keyset pagination, newest first). */
export const auditLogQuerySchema = z.object({
  before: z
    .string()
    .regex(/^[1-9]\d{0,18}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX).default(50),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditEntrySchema = z.object({
  /** bigint as a decimal string. */
  id: z.string(),
  createdAt: z.iso.datetime(),
  action: z.enum(AUDIT_ACTIONS),
  actor: z.object({ id: z.uuid(), email: z.string().nullable() }).nullable(),
  projectId: z.uuid().nullable(),
  target: z.object({ type: z.enum(AUDIT_TARGET_TYPES), id: z.uuid() }).nullable(),
  details: z.record(z.string(), z.unknown()),
  requestId: z.uuid().nullable(),
  ipPrefix: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditLogResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
  /** Pass as `before` for the next page; `null` on the last page. */
  nextBefore: z.string().nullable(),
});
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
