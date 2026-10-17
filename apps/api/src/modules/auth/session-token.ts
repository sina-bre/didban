import { createHash, randomBytes } from "node:crypto";

/** 256-bit opaque token for the cookie. Only its SHA-256 is stored (spec §11). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Cheap shape check before hashing: 32 random bytes are always 43 base64url characters. */
export function isWellFormedToken(token: string | undefined): token is string {
  return token !== undefined && /^[A-Za-z0-9_-]{43}$/.test(token);
}
