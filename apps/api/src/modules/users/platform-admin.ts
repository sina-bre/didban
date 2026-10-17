import { emailSchema } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { recordAudit } from "../audit/record-audit.js";
import { revokeAllSessions } from "../auth/revoke-sessions.js";

export class PlatformAdminError extends Error {}

/**
 * Spec §9.1: `is_platform_admin` is set only through the CLI, never through HTTP.
 * A change of the flag is a privilege change, so the user's sessions are revoked (ADR 0018).
 * Returns false when the flag already had that value (nothing revoked).
 */
export async function setPlatformAdmin(
  sql: Sql,
  rawEmail: string,
  value: boolean,
): Promise<boolean> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) throw new PlatformAdminError("That is not a valid email address.");
  return sql.begin(async (tx) => {
    const [user] = await tx<{ id: string; isPlatformAdmin: boolean }[]>`
      SELECT id, is_platform_admin FROM users WHERE email = ${email.data} FOR UPDATE`;
    if (!user) throw new PlatformAdminError("No user with that email.");
    if (user.isPlatformAdmin === value) return false;
    await tx`UPDATE users SET is_platform_admin = ${value}, updated_at = now() WHERE id = ${user.id}`;
    await revokeAllSessions(tx, user.id);
    await recordAudit(tx, {
      action: value ? "user.platform_admin_granted" : "user.platform_admin_revoked",
      actorUserId: null, // CLI only (spec Â§9.1)
      target: { type: "user", id: user.id },
    });
    return true;
  });
}
