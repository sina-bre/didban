import { z } from "zod";

// Spec §11: length 12–128, no composition rules. The common-password check runs on the server only.
export const PASSWORD_LIMITS = { min: 12, max: 128 } as const;

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Login takes any non-empty password up to the max: the policy applies when one is set, not here. */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_LIMITS.max),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_LIMITS.max),
  newPassword: z.string().max(PASSWORD_LIMITS.max),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const meResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string(),
    isPlatformAdmin: z.boolean(),
    /** True after creation or reset: only me, logout and password change work until it is done. */
    mustChangePassword: z.boolean(),
  }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
