import { randomBytes } from "node:crypto";
import { type Algorithm, hash, parseOptions, verify } from "@node-rs/argon2";

// ADR 0017: Argon2id at the OWASP baseline (19 MiB, 2 passes, 1 lane). Raising these values makes
// every older hash "stale"; it is upgraded on the user's next successful login.
const ARGON2ID = 2 as Algorithm; // const enum: SWC cannot inline it, so use the documented value
export const ARGON2_PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_PARAMS);
}

/** False for malformed hashes instead of throwing, so the login path stays uniform. */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

export function needsRehash(stored: string): boolean {
  const current = parseOptions(stored);
  return (
    current.algorithm !== ARGON2_PARAMS.algorithm ||
    current.memoryCost < ARGON2_PARAMS.memoryCost ||
    current.timeCost < ARGON2_PARAMS.timeCost ||
    current.parallelism !== ARGON2_PARAMS.parallelism ||
    current.outputLen !== ARGON2_PARAMS.outputLen
  );
}

let dummy: Promise<string> | undefined;

/** A real hash of a random secret: unknown accounts pay the same verify cost (spec §11). */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(32).toString("base64url"));
  return dummy;
}
