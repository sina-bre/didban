import type { Env } from "../../config/env.js";

// Spec §11: `__Host-sid` (Secure, no Domain) in production; plain `sid` over local http.
export const ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function cookieName(env: Env): string {
  return env.SESSION_COOKIE === "secure" ? "__Host-sid" : "sid";
}

function attributes(env: Env, maxAgeSeconds: number): string {
  const secure = env.SESSION_COOKIE === "secure" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function sessionCookie(env: Env, token: string): string {
  return `${cookieName(env)}=${token}${attributes(env, ABSOLUTE_LIFETIME_MS / 1000)}`;
}

export function clearedSessionCookie(env: Env): string {
  return `${cookieName(env)}=${attributes(env, 0)}`;
}

/** Reads one cookie from the raw header. The first match wins, as browsers send the most specific first. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}
