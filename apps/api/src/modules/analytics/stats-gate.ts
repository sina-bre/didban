import { formatFilter, type StatsQuery } from "@didban/contracts";
import { AppError } from "../../http/app-error.js";

// Spec §10: at most 3 concurrent stats queries per project (in-process semaphore; a request waits
// ≤ 2 s for a slot, then 429) and a 15 s per-process LRU response cache keyed by (project,
// normalized query). Callers reach this only after the permission guard, so a cached answer is
// only ever served to someone allowed to see that project. Realtime passes a `null` key.

export const MAX_CONCURRENT = 3;
export const QUEUE_WAIT_MS = 2000;
export const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 500;

type Slot = { active: number; waiting: (() => void)[] };
type Cached = { at: number; value: unknown };

export class StatsGate {
  private readonly slots = new Map<string, Slot>();
  private readonly cache = new Map<string, Cached>();

  constructor(private readonly now: () => number = Date.now) {}

  async run<T>(projectId: string, key: string | null, work: () => Promise<T>): Promise<T> {
    const cacheKey = key === null ? null : `${projectId}|${key}`;
    const hit = cacheKey ? this.cache.get(cacheKey) : undefined;
    if (cacheKey && hit && this.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
    await this.acquire(projectId);
    try {
      const value = await work();
      if (cacheKey) this.remember(cacheKey, value);
      return value;
    } finally {
      this.release(projectId);
    }
  }

  /** Drops a project's cached answers: its definitions (goals) changed, so they are stale. */
  forget(projectId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${projectId}|`)) this.cache.delete(key);
    }
  }

  private acquire(projectId: string): Promise<void> {
    const slot = this.slots.get(projectId) ?? { active: 0, waiting: [] };
    this.slots.set(projectId, slot);
    if (slot.active < MAX_CONCURRENT) {
      slot.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        slot.active += 1;
        resolve();
      };
      const timer = setTimeout(() => {
        slot.waiting = slot.waiting.filter((g) => g !== grant);
        reject(
          new AppError(429, "RATE_LIMITED", "Too many stats queries for this project", {
            "retry-after": "1",
          }),
        );
      }, QUEUE_WAIT_MS);
      slot.waiting.push(grant);
    });
  }

  private release(projectId: string): void {
    const slot = this.slots.get(projectId);
    if (!slot) return;
    slot.active -= 1;
    const next = slot.waiting.shift();
    if (next) next();
    else if (slot.active === 0) this.slots.delete(projectId);
  }

  private remember(key: string, value: unknown): void {
    this.cache.delete(key);
    this.cache.set(key, { at: this.now(), value });
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}

/** Cache key of one request: route + parsed query, filters sorted (their order does not matter). */
export function queryKey(route: string, query: StatsQuery): string {
  const filter = query.filter.map(formatFilter).sort();
  return `${route}|${JSON.stringify({ ...query, filter })}`;
}
