// Backend budgets (addendum A2) set from the first measured baseline, 2026-10-18 (docs/load-baseline.md):
// throughput floor ≈ 80 % of the slowest of three runs, latency ceilings ≈ 1.5× the measured value.
// Valid for the reference box in that doc; a different machine needs its own baseline first.
export const BUDGETS = {
  sustained: { minEventsPerS: 2400, p95Ms: 80, p99Ms: 150, maxErrorRate: 0 },
  burst: { minEventsPerS: 7000, p95Ms: 850, p99Ms: 1000, maxErrorRate: 0 },
  abusive: { p95Ms: 20, p99Ms: 25 },
};
export const MAX_RSS_MB = 512;

/** Returns the broken budgets of one scenario result as readable lines (empty = all met). */
export function brokenBudgets(name, result) {
  const budget = BUDGETS[name];
  if (!budget) return [];
  const { http, db, api } = result;
  const broken = [];
  const check = (ok, line) => ok || broken.push(`${name}: ${line}`);
  if (budget.minEventsPerS !== undefined) {
    check(
      http.eventsOkPerS >= budget.minEventsPerS,
      `${http.eventsOkPerS.toFixed(0)} events/s < ${budget.minEventsPerS}`,
    );
  }
  check(
    http.latencyMs.p95 <= budget.p95Ms,
    `p95 ${http.latencyMs.p95.toFixed(1)} ms > ${budget.p95Ms}`,
  );
  check(
    http.latencyMs.p99 <= budget.p99Ms,
    `p99 ${http.latencyMs.p99.toFixed(1)} ms > ${budget.p99Ms}`,
  );
  if (budget.maxErrorRate !== undefined) {
    check(
      http.errorRate <= budget.maxErrorRate,
      `error rate ${http.errorRate} > ${budget.maxErrorRate}`,
    );
  }
  check(http.timeouts === 0 && http.connectionErrors === 0, "connection errors or timeouts");
  check(db.deadlocks === 0, `${db.deadlocks} deadlocks`);
  check(api.rssMaxMb <= MAX_RSS_MB, `RSS ${api.rssMaxMb.toFixed(0)} MB > ${MAX_RSS_MB}`);
  return broken;
}
