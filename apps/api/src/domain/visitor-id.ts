import { createHash } from "node:crypto";

// Spec §4 identity. A visitor ID is always the first 16 bytes of a SHA-256 over the project ID and
// one identifier, with a label and NUL separators so two inputs can never collide by concatenation.
// The project ID is in every hash: different projects never share visitor IDs.

const MAX_USER_AGENT_LENGTH = 512;

function digest(label: string, parts: readonly (string | Buffer)[]): Buffer {
  const hash = createHash("sha256").update(label);
  for (const part of parts) hash.update("\0").update(part);
  return hash.digest().subarray(0, 16);
}

/** `cookieless`: SHA-256(daily salt ‖ project ‖ IP ‖ normalized UA). The salt rotates daily (UTC). */
export function cookielessVisitorId(
  salt: Buffer,
  projectId: string,
  client: { ip: string; userAgent: string },
): Buffer {
  const userAgent = client.userAgent.trim().toLowerCase().slice(0, MAX_USER_AGENT_LENGTH);
  return digest("cookieless", [salt, projectId, client.ip, userAgent]);
}

/** `persistent` mode, and server events that carry the browser's `anonymousId`. */
export function anonymousVisitorId(projectId: string, anonymousId: string): Buffer {
  return digest("anonymous", [projectId, anonymousId]);
}

/** Server events with only a `userId`: stable per user, never joined to a browser visit. */
export function userVisitorId(projectId: string, userId: string): Buffer {
  return digest("user", [projectId, userId]);
}
