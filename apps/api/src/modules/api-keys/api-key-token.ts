import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyKind } from "@didban/contracts";

// Token: `<tag>_<12 hex>_<43 base64url>`. The first 16 chars are the displayed prefix; the
// 256-bit random tail is the secret. Only SHA-256 of the whole token is stored (spec §9.1).
// The tag tells a reader what leaked: `dpk` browser keys are public, `dsk` server keys are not.
const TAGS: Record<ApiKeyKind, string> = { write_browser: "dpk", write_server: "dsk" };

export type NewApiKeyToken = { token: string; prefix: string; secretHash: Buffer };

export function newApiKeyToken(kind: ApiKeyKind): NewApiKeyToken {
  const prefix = `${TAGS[kind]}_${randomBytes(6).toString("hex")}`;
  const token = `${prefix}_${randomBytes(32).toString("base64url")}`;
  return { token, prefix, secretHash: hashApiKeyToken(token) };
}

export function hashApiKeyToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
