import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";

// Spec §11: idle timeout 7 days (sliding), absolute lifetime 30 days, last_seen_at written at most
// once per 5 minutes. Expired rows are ignored here and purged by the retention job (Stage 6).
const IDLE = "7 days";
const ABSOLUTE = "30 days";
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionPrincipal = {
  sessionId: string;
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  lastSeenAt: Date;
};

export type NewSession = { userId: string; tokenHash: Buffer; uaLabel: string; ipPrefix: string };

@Injectable()
export class AuthSessionRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async create(session: NewSession): Promise<void> {
    await this.sql`
      INSERT INTO auth_sessions (user_id, token_hash, ua_label, ip_prefix, expires_at)
      VALUES (${session.userId}, ${session.tokenHash}, ${session.uaLabel}, ${session.ipPrefix},
              now() + ${ABSOLUTE}::interval)`;
  }

  async findValid(tokenHash: Buffer): Promise<SessionPrincipal | undefined> {
    const [row] = await this.sql<SessionPrincipal[]>`
      SELECT s.id AS session_id, s.user_id, s.last_seen_at, u.email, u.is_platform_admin,
             u.must_change_password
      FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.expires_at > now()
        AND s.last_seen_at > now() - ${IDLE}::interval`;
    return row;
  }

  /** Slides the idle window. The WHERE clause keeps concurrent requests to one write. */
  async touch(sessionId: string): Promise<void> {
    await this.sql`
      UPDATE auth_sessions SET last_seen_at = now()
      WHERE id = ${sessionId} AND last_seen_at < now() - interval '5 minutes'`;
  }

  async deleteByToken(tokenHash: Buffer): Promise<void> {
    await this.sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash}`;
  }
}
