// Spec §7 step 3 + §3.1 Data Health: rejections counted in memory by (environment, hour, code),
// plus the rejected Origin values (≤ 255 chars, ≤ 20 distinct per environment and day). The
// flusher drains this once a minute. Both maps are bounded; past the bound, new rows are dropped.
const MAX_COUNTERS = 10_000;
const MAX_ORIGIN_LENGTH = 255;
export const MAX_ORIGINS_PER_DAY = 20;

export type DiagnosticTarget = { projectId: string; environmentId: string };
export type CounterRow = DiagnosticTarget & { hour: string; code: string; count: number };
export type OriginRow = DiagnosticTarget & {
  day: string;
  origin: string;
  count: number;
  lastSeenAt: string;
};
export type DrainedDiagnostics = { counters: CounterRow[]; origins: OriginRow[] };

export class IngestDiagnostics {
  private counters = new Map<string, CounterRow>();
  private origins = new Map<string, OriginRow>();
  private originsPerDay = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  record(target: DiagnosticTarget, code: string, count = 1): void {
    const hour = new Date(Math.floor(this.now() / 3_600_000) * 3_600_000).toISOString();
    const id = `${target.environmentId}|${hour}|${code}`;
    const row = this.counters.get(id);
    if (row) row.count += count;
    else if (this.counters.size < MAX_COUNTERS)
      this.counters.set(id, { ...target, hour, code, count });
  }

  recordOrigin(target: DiagnosticTarget, rawOrigin: string): void {
    const now = new Date(this.now());
    const day = now.toISOString().slice(0, 10);
    const origin = rawOrigin.slice(0, MAX_ORIGIN_LENGTH);
    const id = `${target.environmentId}|${day}|${origin}`;
    const row = this.origins.get(id);
    if (row) {
      row.count += 1;
      row.lastSeenAt = now.toISOString();
      return;
    }
    const dayId = `${target.environmentId}|${day}`;
    const distinct = this.originsPerDay.get(dayId) ?? 0;
    if (distinct >= MAX_ORIGINS_PER_DAY) return;
    this.originsPerDay.set(dayId, distinct + 1);
    this.origins.set(id, { ...target, day, origin, count: 1, lastSeenAt: now.toISOString() });
  }

  /** Returns everything recorded since the last drain and starts over. */
  drain(): DrainedDiagnostics {
    const drained = { counters: [...this.counters.values()], origins: [...this.origins.values()] };
    this.counters = new Map();
    this.origins = new Map();
    this.originsPerDay = new Map();
    return drained;
  }
}
