import type { Sql } from "../db/db.module.js";
import { PlatformAdminError, setPlatformAdmin } from "../modules/users/platform-admin.js";

/** `pnpm cli grant-platform-admin <email>` / `revoke-platform-admin <email>`. */
export function platformAdminCommand(value: boolean) {
  const verb = value ? "grant" : "revoke";
  const state = value ? "is a platform admin" : "is not a platform admin";
  return async (sql: Sql, args: string[]): Promise<number> => {
    const email = args[0];
    if (!email) {
      console.error(`Usage: pnpm cli ${verb}-platform-admin <email>`);
      return 1;
    }
    try {
      const changed = await setPlatformAdmin(sql, email, value);
      const suffix = changed ? " now; their sessions were revoked." : " already.";
      console.log(`${email} ${state}${suffix}`);
      return 0;
    } catch (error) {
      if (!(error instanceof PlatformAdminError)) throw error;
      console.error(error.message);
      return 1;
    }
  };
}
