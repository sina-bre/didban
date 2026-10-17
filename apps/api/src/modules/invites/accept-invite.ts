import { Inject, Injectable } from "@nestjs/common";
import type postgres from "postgres";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError } from "../../http/app-error.js";
import { recordAudit } from "../audit/record-audit.js";
import { AuthSessionRepository } from "../auth/auth-session.repository.js";
import { invalidCredentials, type PublicUser, rateLimited } from "../auth/login.js";
import { LoginLimiter } from "../auth/login-limiter.js";
import { hashPassword, verifyPassword } from "../auth/password-hasher.js";
import { checkPassword } from "../auth/password-policy.js";
import { type SessionStart, startSession } from "../auth/start-session.js";
import { findOpenInvite, type OpenInvite } from "./open-invite.js";

export type AcceptInput = Omit<SessionStart, "userId"> & { token: string; password: string };

const changedMeanwhile = () => new AppError(409, "CONFLICT", "Please try again");

/**
 * Spec §11: single-use invite. New email → the password becomes the account's password (policy
 * applies). Existing account → the password must be its current one (rate-limited like login),
 * so a forwarded link alone cannot add someone's account to an organization. Ends signed in.
 * Phase 1 does the Argon2 work without locks; phase 2 re-checks everything under row locks.
 */
@Injectable()
export class AcceptInvite {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sessions: AuthSessionRepository,
    @Inject(LoginLimiter) private readonly limiter: LoginLimiter,
  ) {}

  async execute(input: AcceptInput): Promise<{ token: string; user: PublicUser }> {
    const preview = await findOpenInvite(this.sql, input.token, false);
    const newHash = await this.checkPassword(preview, input);
    const user = await this.sql.begin(async (tx) => {
      const invite = await findOpenInvite(tx, input.token, true);
      if (invite.userId !== preview.userId) throw changedMeanwhile();
      const userId = invite.userId ?? (await createUser(tx, invite.email, newHash));
      await join(tx, invite, userId);
      return { id: userId, email: invite.email };
    });
    this.limiter.recordSuccess(input.ip, preview.email);
    const token = await startSession(this.sessions, { ...input, userId: user.id });
    const self = { type: "user" as const, id: user.id };
    await recordAudit(this.sql, {
      action: "auth.login_succeeded",
      actorUserId: user.id,
      target: self,
    });
    const [row] = await this.sql<{ isPlatformAdmin: boolean }[]>`
      SELECT is_platform_admin FROM users WHERE id = ${user.id}`;
    return { token, user: { ...user, isPlatformAdmin: row?.isPlatformAdmin ?? false } };
  }

  /** Returns the new account's hash, or `null` after verifying an existing account's password. */
  private async checkPassword(invite: OpenInvite, input: AcceptInput): Promise<string | null> {
    const wait = this.limiter.retryAfter(input.ip, invite.email);
    if (wait > 0) throw rateLimited(wait);
    if (!invite.userId) {
      const problem = checkPassword(input.password);
      if (problem) throw new AppError(400, `PASSWORD_${problem}`, "Password rejected");
      return hashPassword(input.password);
    }
    const [user] = await this.sql<{ passwordHash: string }[]>`
      SELECT password_hash FROM users WHERE id = ${invite.userId}`;
    if (user && (await verifyPassword(user.passwordHash, input.password))) return null;
    this.limiter.recordFailure(input.ip, invite.email);
    const target = { type: "user" as const, id: invite.userId };
    await recordAudit(this.sql, { action: "auth.login_failed", actorUserId: null, target });
    throw invalidCredentials();
  }
}

async function createUser(tx: postgres.TransactionSql, email: string, hash: string | null) {
  if (!hash) throw changedMeanwhile();
  const [user] = await tx<{ id: string }[]>`
    INSERT INTO users (email, password_hash) VALUES (${email}, ${hash})
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!user) throw changedMeanwhile();
  return user.id;
}

async function join(tx: postgres.TransactionSql, invite: OpenInvite, userId: string) {
  const joined = await tx`
    INSERT INTO memberships (user_id, organization_id, role)
    VALUES (${userId}, ${invite.organizationId}, ${invite.role})
    ON CONFLICT DO NOTHING RETURNING user_id`;
  if (joined.length === 0) throw new AppError(409, "ALREADY_MEMBER", "Already a member");
  await tx`UPDATE invites SET accepted_at = now(), accepted_user_id = ${userId}
           WHERE id = ${invite.id}`;
  await recordAudit(tx, {
    action: "invite.accepted",
    actorUserId: userId,
    organizationId: invite.organizationId,
    target: { type: "invite", id: invite.id },
    details: { role: invite.role },
  });
}
