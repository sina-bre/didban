// Catalog 23.1 "ingestion debugger": the last 20 rejected batches per environment (code, origin,
// time; never the payload), in memory and per process. Ingestion writes, Data Health reads; it
// lives outside both so analytics never depends on ingestion. Bounded in environments too.

export const RECENT_PER_ENVIRONMENT = 20;
const MAX_ENVIRONMENTS = 10_000;
const MAX_ORIGIN_LENGTH = 255;

export type RecentRejection = { at: string; code: string; origin: string | null };

export class RecentRejections {
  private readonly byEnvironment = new Map<string, RecentRejection[]>();

  constructor(private readonly now: () => number = Date.now) {}

  add(environmentId: string, code: string, origin: string | undefined): void {
    const list = this.byEnvironment.get(environmentId) ?? [];
    this.byEnvironment.delete(environmentId);
    this.byEnvironment.set(environmentId, list); // most recently used last
    const entry = {
      at: new Date(this.now()).toISOString(),
      code,
      origin: origin?.slice(0, MAX_ORIGIN_LENGTH) ?? null,
    };
    list.unshift(entry);
    if (list.length > RECENT_PER_ENVIRONMENT) list.length = RECENT_PER_ENVIRONMENT;
    while (this.byEnvironment.size > MAX_ENVIRONMENTS) {
      const oldest = this.byEnvironment.keys().next().value;
      if (oldest === undefined) break;
      this.byEnvironment.delete(oldest);
    }
  }

  /** Newest first, across the given environments, at most RECENT_PER_ENVIRONMENT. */
  list(environmentIds: readonly string[]): RecentRejection[] {
    return environmentIds
      .flatMap((id) => this.byEnvironment.get(id) ?? [])
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, RECENT_PER_ENVIRONMENT);
  }
}
