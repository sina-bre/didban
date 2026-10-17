import { z } from "zod";
import { emailSchema } from "./auth.js";
import { orgRoleSchema } from "./organizations.js";

// ADR 0024: no invites and no signup. Owners/admins create users; the server generates a
// one-time temporary password, shown once, which the user must replace at first login.

export const createUserRequestSchema = z.object({ email: emailSchema, role: orgRoleSchema });
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

/** Platform admins create an organization's owner. */
export const createOwnerRequestSchema = z.object({ email: emailSchema });
export type CreateOwnerRequest = z.infer<typeof createOwnerRequestSchema>;

/** The only response with the temporary password. Only its Argon2 hash is stored. */
export const createdUserSchema = z.object({
  userId: z.uuid(),
  email: z.string(),
  role: orgRoleSchema,
  temporaryPassword: z.string(),
});
export type CreatedUser = z.infer<typeof createdUserSchema>;

export const passwordResetResponseSchema = z.object({ temporaryPassword: z.string() });
export type PasswordResetResponse = z.infer<typeof passwordResetResponseSchema>;
