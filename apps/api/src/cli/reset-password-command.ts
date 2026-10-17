import { emailSchema } from "@didban/contracts";
import type { Sql } from "../db/db.module.js";
import { applyPasswordReset } from "../modules/users/reset-password.js";

/**
 * `pnpm cli reset-password <email>` (spec §11): the operator's reset for any account, also
 * platform admins and members of several organizations. Prints the temporary password once.
 */
export async function resetPasswordCommand(sql: Sql, args: string[]): Promise<number> {
  const email = emailSchema.safeParse(args[0] ?? "");
  if (!email.success) {
    console.error("Usage: pnpm cli reset-password <email>");
    return 1;
  }
  const password = await sql.begin(async (tx) => {
    const [user] = await tx<{ id: string }[]>`
      SELECT id FROM users WHERE email = ${email.data} FOR UPDATE`;
    if (!user) return null;
    return applyPasswordReset(tx, { organizationId: null, userId: user.id, actorUserId: null });
  });
  if (!password) {
    console.error("No user with that email.");
    return 1;
  }
  console.log(`Temporary password for ${email.data} (shown once, must be changed at login):`);
  console.log(password);
  console.log("All of their sessions were revoked.");
  return 0;
}
