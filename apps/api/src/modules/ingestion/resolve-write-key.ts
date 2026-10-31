import { Inject, Injectable } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { hashApiKeyToken } from "../api-keys/api-key-token.js";
import { ingestError } from "./ingest-error.js";
import { type SettingsRow, toIngestSettings } from "./ingest-settings.js";
import { KeyUsage } from "./key-usage.js";
import { type ResolvedKey, WriteKeyCache } from "../key-cache/write-key-cache.js";

// Spec §7 step 2. A token that cannot be ours (wrong shape) is rejected without a lookup.
// Keys of archived projects or suspended organizations resolve like unknown keys.
const TOKEN_PATTERN = /^(dpk|dsk)_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/;

const invalid = () => ingestError("INVALID_WRITE_KEY", "Invalid write key");

type KeyRow = Omit<ResolvedKey, "settings"> & SettingsRow;

async function lookup(sql: Sql, secretHash: Buffer): Promise<ResolvedKey | null> {
  const [row] = await sql<KeyRow[]>`
    SELECT k.id AS key_id, p.organization_id, k.project_id, k.environment_id, k.kind,
           k.revoked_at IS NOT NULL AS revoked, e.allowed_origins,
           e.identity_mode, e.excluded_cidrs, e.track_localhost,
           p.allow_identify, p.session_timeout_minutes, p.pii_guard, p.url_param_allowlist,
           p.trailing_slash_policy, p.hash_routing, p.store_city, p.site_search_params,
           ARRAY(SELECT r.pattern FROM route_templates r
                 WHERE r.project_id = k.project_id ORDER BY r.position) AS route_patterns
    FROM api_keys k
    JOIN environments e ON e.id = k.environment_id
    JOIN projects p ON p.id = k.project_id
    JOIN organizations o ON o.id = p.organization_id
    WHERE k.secret_hash = ${secretHash} AND p.archived_at IS NULL AND o.suspended_at IS NULL`;
  if (!row) return null;
  const { keyId, organizationId, projectId, environmentId, kind, revoked, allowedOrigins } = row;
  const base = { keyId, organizationId, projectId, environmentId, kind, revoked, allowedOrigins };
  return { ...base, settings: toIngestSettings(row) };
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
