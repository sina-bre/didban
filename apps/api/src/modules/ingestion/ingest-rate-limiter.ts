// Spec §7 step 4 + §2: in-memory, per process, fixed one-minute windows. Two separate buckets
// (per key, per IP) share one map; the prefix in the bucket name keeps them apart.
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 100_000; // bounds memory under a flood of IPs

type Window = { start: number; count: number };

export class IngestRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Counts one request against `bucket`. Returns seconds to wait; 0 = allowed. */
  take(bucket: string, limitPerMinute: number): number {
    const now = this.now();
    let window = this.windows.get(bucket);
    if (!window || now - window.start >= WINDOW_MS) {
      window = { start: now, count: 0 };
      this.windows.delete(bucket);
      this.windows.set(bucket, window);
      this.evict();
    }
    if (window.count >= limitPerMinute) {
      return Math.max(1, Math.ceil((window.start + WINDOW_MS - now) / 1000));
    }
    window.count += 1;
    return 0;
  }

  private evict(): void {
    while (this.windows.size > MAX_ENTRIES) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
