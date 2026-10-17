import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError } from "../../http/app-error.js";
import type { SessionPrincipal } from "./auth-session.repository.js";
import { invalidCredentials, rateLimited } from "./login.js";
import { LoginLimiter } from "./login-limiter.js";
import { hashPassword, verifyPassword } from "./password-hasher.js";
import { checkPassword } from "./password-policy.js";

export type ChangePasswordInput = {
  principal: SessionPrincipal;
  currentPassword: string;
  newPassword: string;
  ip: string;
};

/** Spec §11: re-check the current password (rate-limited like login), revoke all other sessions. */
@Injectable()
export class ChangePassword {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(LoginLimiter) private readonly limiter: LoginLimiter,
  ) {}

  async execute({ principal, currentPassword, newPassword, ip }: ChangePasswordInput) {
    const wait = this.limiter.retryAfter(ip, principal.email);
    if (wait > 0) throw rateLimited(wait);
    const [user] = await this.sql<{ passwordHash: string }[]>`
      SELECT password_hash FROM users WHERE id = ${principal.userId}`;
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
      this.limiter.recordFailure(ip, principal.email);
      throw invalidCredentials();
    }
    const problem = checkPassword(newPassword);
    if (problem) throw new AppError(400, `PASSWORD_${problem}`, "Password rejected");
    const passwordHash = await hashPassword(newPassword);
    await this.sql.begin(async (tx) => {
      await tx`UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
               WHERE id = ${principal.userId}`;
      await tx`DELETE FROM auth_sessions
               WHERE user_id = ${principal.userId} AND id <> ${principal.sessionId}`;
    });
  }
}
