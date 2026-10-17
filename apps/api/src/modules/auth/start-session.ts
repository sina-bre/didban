import type { AuthSessionRepository } from "./auth-session.repository.js";
import { truncateIp, uaLabel } from "./client-meta.js";
import { hashSessionToken, isWellFormedToken, newSessionToken } from "./session-token.js";

export type SessionStart = {
  userId: string;
  ip: string;
  userAgent: string | undefined;
  /** The cookie the browser already sent, if any. */
  currentToken: string | undefined;
};

/** Rotation on login (spec §11): a session the browser already had is dropped, a new token issued. */
export async function startSession(
  sessions: AuthSessionRepository,
  start: SessionStart,
): Promise<string> {
  if (isWellFormedToken(start.currentToken)) {
    await sessions.deleteByToken(hashSessionToken(start.currentToken));
  }
  const token = newSessionToken();
  await sessions.create({
    userId: start.userId,
    tokenHash: hashSessionToken(token),
    uaLabel: uaLabel(start.userAgent),
    ipPrefix: truncateIp(start.ip),
  });
  return token;
}
