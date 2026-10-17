import type { Sql } from "../../db/db.module.js";

// Spec §9.1: `api_keys.last_used_at` is kept in memory and written at most once per minute per
// key (by the flusher), so ingestion never writes a key row per request.

export class KeyUsage {
  private lastUsed = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  touch(keyId: string): void {
    this.lastUsed.set(keyId, this.now());
  }

  /** Writes and forgets everything recorded so far. */
  async flush(sql: Sql): Promise<void> {
    if (this.lastUsed.size === 0) return;
    const entries = [...this.lastUsed];
    this.lastUsed = new Map();
    const ids = entries.map(([id]) => id);
    const times = entries.map(([, at]) => new Date(at).toISOString());
    await sql`
      UPDATE api_keys k SET last_used_at = v.at
      FROM unnest(${ids}::uuid[], ${times}::timestamptz[]) AS v(id, at)
      WHERE k.id = v.id AND (k.last_used_at IS NULL OR k.last_used_at < v.at)`;
  }
}
