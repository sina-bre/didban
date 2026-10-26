import { changePasswordRequestSchema, PASSWORD_LIMITS } from "@didban/contracts";
import { z } from "zod";

// The contract schema plus what the form can check before sending: the length policy and the
// repeated password. The common-password list stays on the server (spec §11).
export const setPasswordSchema = changePasswordRequestSchema
  .extend({
    newPassword: z.string().min(PASSWORD_LIMITS.min).max(PASSWORD_LIMITS.max),
    confirm: z.string(),
  })
  .refine((form) => form.confirm === form.newPassword, { path: ["confirm"] });

export type SetPasswordForm = z.infer<typeof setPasswordSchema>;

/** Server codes the form explains next to the new-password field. */
export const POLICY_CODES = [
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_COMMON",
  "PASSWORD_UNCHANGED",
] as const;
export type PolicyCode = (typeof POLICY_CODES)[number];

export const isPolicyCode = (code: string | undefined): code is PolicyCode =>
  POLICY_CODES.includes(code as PolicyCode);

/** A client-side length issue reads like the server's answer for the same problem. */
export const lengthCode = (type: string | undefined): PolicyCode | undefined =>
  type === "too_small"
    ? "PASSWORD_TOO_SHORT"
    : type === "too_big"
      ? "PASSWORD_TOO_LONG"
      : undefined;
