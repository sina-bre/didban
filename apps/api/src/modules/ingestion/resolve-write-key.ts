import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { hashApiKeyToken } from "../api-keys/api-key-token.js";
import { ingestError } from "./ingest-error.js";
import { KeyUsage } from "./key-usage.js";
import { type ResolvedKey, WriteKeyCache } from "./write-key-cache.js";

// Spec §7 step 2. A token that cannot be ours (wrong shape) is rejected without a lookup.
// Keys of archived projects or suspended organizations resolve like unknown keys.
const TOKEN_PATTERN = /^(dpk|dsk)_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/;

const invalid = () => ingestError("INVALID_WRITE_KEY", "Invalid write key");

async function lookup(sql: Sql, secretHash: Buffer): Promise<ResolvedKey | null> {
  const [row] = await sql<ResolvedKey[]>`
    SELECT k.id AS key_id, p.organization_id, k.project_id, k.environment_id, k.kind,
           k.revoked_at IS NOT NULL AS revoked, e.allowed_origins
    FROM api_keys k
    JOIN environments e ON e.id = k.environment_id
    JOIN projects p ON p.id = k.project_id
    JOIN organizations o ON o.id = p.organization_id
    WHERE k.secret_hash = ${secretHash} AND p.archived_at IS NULL AND o.suspended_at IS NULL`;
  return row ?? null;
}

@Injectable()
export class WriteKeyResolver {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly cache: WriteKeyCache,
    private readonly usage: KeyUsage,
  ) {}

  async resolve(token: string | undefined): Promise<ResolvedKey> {
    if (!token || !TOKEN_PATTERN.test(token)) throw invalid();
    const secretHash = hashApiKeyToken(token);
    const cacheKey = secretHash.toString("hex");
    let key = this.cache.get(cacheKey);
    if (key === undefined) {
      key = await lookup(this.sql, secretHash);
      this.cache.set(cacheKey, key);
    }
    if (!key) throw invalid();
    if (key.revoked) throw ingestError("WRITE_KEY_REVOKED", "Write key revoked");
    this.usage.touch(key.keyId);
    return key;
  }
}
