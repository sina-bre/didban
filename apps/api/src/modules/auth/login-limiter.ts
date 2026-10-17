// Spec §11 + §2: in-memory, per process. Three buckets count failed logins: per IP, per account,
// per (IP, account). The account bucket never locks hard: it adds a growing delay instead.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_PAIR = 5;
const FREE_ACCOUNT_FAILURES = 5;
const MAX_ACCOUNT_DELAY_MS = 60 * 1000;
const MAX_ENTRIES = 50_000; // bounds memory under a flood of random emails/IPs

type Bucket = { count: number; windowStart: number; lastFailure: number };

const keys = (ip: string, email: string) => ({
  ip: `ip:${ip}`,
  account: `acct:${email}`,
  pair: `pair:${ip}|${email}`,
});

/** Registered with `useFactory` in AuthModule; tests pass a fake clock. */
export class LoginLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Seconds the caller must wait before this attempt may run; 0 = go ahead. */
  retryAfter(ip: string, email: string): number {
    const now = this.now();
    const key = keys(ip, email);
    const waitMs = Math.max(
      this.hardWait(key.ip, MAX_PER_IP, now),
      this.hardWait(key.pair, MAX_PER_PAIR, now),
      this.accountWait(key.account, now),
    );
    return Math.max(0, Math.ceil(waitMs / 1000));
  }

  recordFailure(ip: string, email: string): void {
    const now = this.now();
    for (const key of Object.values(keys(ip, email))) {
      const bucket = this.get(key, now) ?? { count: 0, windowStart: now, lastFailure: now };
      bucket.count += 1;
      bucket.lastFailure = now;
      this.buckets.delete(key); // re-insert: Map order stays "least recently failed first"
      this.buckets.set(key, bucket);
    }
    while (this.buckets.size > MAX_ENTRIES) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }

  recordSuccess(ip: string, email: string): void {
    const key = keys(ip, email);
    this.buckets.delete(key.account);
    this.buckets.delete(key.pair);
  }

  private hardWait(key: string, max: number, now: number): number {
    const bucket = this.get(key, now);
    return bucket && bucket.count >= max ? bucket.windowStart + WINDOW_MS - now : 0;
  }

  /** 1 s after the 5th failure, then doubling, capped at 60 s. */
  private accountWait(key: string, now: number): number {
    const bucket = this.get(key, now);
    if (!bucket || bucket.count < FREE_ACCOUNT_FAILURES) return 0;
    const delay = 1000 * 2 ** (bucket.count - FREE_ACCOUNT_FAILURES);
    return bucket.lastFailure + Math.min(delay, MAX_ACCOUNT_DELAY_MS) - now;
  }

  private get(key: string, now: number): Bucket | undefined {
    const bucket = this.buckets.get(key);
    if (bucket && now - bucket.windowStart >= WINDOW_MS) {
      this.buckets.delete(key);
      return undefined;
    }
    return bucket;
  }
}
