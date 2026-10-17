import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError } from "../../http/app-error.js";
import { recordAudit } from "../audit/record-audit.js";
import { AuthSessionRepository } from "./auth-session.repository.js";
import { LoginLimiter } from "./login-limiter.js";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./password-hasher.js";
import { startSession } from "./start-session.js";

export type LoginInput = {
  email: string;
  password: string;
  ip: string;
  userAgent: string | undefined;
  currentToken: string | undefined;
};
export type PublicUser = { id: string; email: string; isPlatformAdmin: boolean };
type UserRow = PublicUser & { passwordHash: string };

export const rateLimited = (seconds: number) =>
  new AppError(429, "RATE_LIMITED", "Too many attempts", { "retry-after": String(seconds) });
export const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

/** Spec §11: one code path for "no such user" and "wrong password" (same work, same answer). */
@Injectable()
export class Login {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sessions: AuthSessionRepository,
    @Inject(LoginLimiter) private readonly limiter: LoginLimiter,
  ) {}

  async execute(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
    const wait = this.limiter.retryAfter(input.ip, input.email);
    if (wait > 0) throw rateLimited(wait);
    const [row] = await this.sql<UserRow[]>`
      SELECT id, email, password_hash, is_platform_admin FROM users WHERE email = ${input.email}`;
    const valid = await verifyPassword(row?.passwordHash ?? (await dummyHash()), input.password);
    if (!row || !valid) {
      this.limiter.recordFailure(input.ip, input.email);
      // The typed email is never stored: people paste passwords into it (ADR 0022).
      await recordAudit(this.sql, {
        action: "auth.login_failed",
        actorUserId: null,
        ...(row && { target: { type: "user" as const, id: row.id } }),
      });
      throw invalidCredentials();
    }
    this.limiter.recordSuccess(input.ip, input.email);
    if (needsRehash(row.passwordHash)) await this.rehash(row.id, input.password);
    const user = { id: row.id, email: row.email, isPlatformAdmin: row.isPlatformAdmin };
    const token = await startSession(this.sessions, { ...input, userId: row.id });
    await recordAudit(this.sql, {
      action: "auth.login_succeeded",
      actorUserId: row.id,
      target: { type: "user", id: row.id },
    });
    return { token, user };
  }

  private async rehash(userId: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.sql`
      UPDATE users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${userId}`;
  }
}
