import type { ApiKeyKind } from "@didban/contracts";

// Spec §7 step 2: per-process LRU of resolved write keys. Known keys live 60 s, unknown ones
// 10 s, so a revocation takes effect within 60 s on every process (ADR 0025).
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const MAX_ENTRIES = 10_000;

export type ResolvedKey = {
  keyId: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  kind: ApiKeyKind;
  revoked: boolean;
  allowedOrigins: readonly string[];
};

type Entry = { value: ResolvedKey | null; expiresAt: number };

/** Keyed by the token's SHA-256 (hex), never by the token itself. `null` = unknown key. */
export class WriteKeyCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  /** `undefined` = not cached (or expired): the caller looks the key up. */
  get(hash: string): ResolvedKey | null | undefined {
    const entry = this.entries.get(hash);
    if (!entry) return undefined;
    this.entries.delete(hash);
    if (entry.expiresAt <= this.now()) return undefined;
    this.entries.set(hash, entry); // re-insert: Map order stays least recently used first
    return entry.value;
  }

  set(hash: string, value: ResolvedKey | null): void {
    const ttl = value ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    this.entries.delete(hash);
    this.entries.set(hash, { value, expiresAt: this.now() + ttl });
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
