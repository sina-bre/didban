// Runs one scenario with autocannon and keeps every response time, so p50/p95/p99 are exact
// (autocannon's own histogram has no p95). Closed loop: N connections, one request in flight each.
import autocannon from "autocannon";

const percentile = (sorted, p) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

export async function runScenario(base, scenario, writeKey) {
  const next = scenario.build(writeKey);
  const times = [];
  const instance = autocannon({
    url: base,
    ...scenario.options,
    requests: [{ setupRequest: (request) => ({ ...request, ...next() }) }],
  });
  instance.on("response", (_client, _status, _bytes, ms) => times.push(ms));
  const result = await instance;
  times.sort((a, b) => a - b);
  const statuses = Object.fromEntries(
    Object.entries(result.statusCodeStats).map(([code, { count }]) => [code, Number(count)]),
  );
  const total = Object.values(statuses).reduce((a, b) => a + b, 0);
  const ok = statuses[200] ?? 0;
  return {
    durationS: result.duration,
    connections: result.connections,
    requests: total,
    requestsPerS: total / result.duration,
    batchesOkPerS: ok / result.duration,
    eventsOkPerS: (ok * scenario.eventsPerBatch) / result.duration,
    latencyMs: {
      p50: percentile(times, 0.5),
      p95: percentile(times, 0.95),
      p99: percentile(times, 0.99),
      max: times.at(-1) ?? 0,
    },
    statuses,
    errorRate: total === 0 ? 0 : (total - ok) / total,
    connectionErrors: result.errors,
    timeouts: result.timeouts,
  };
}
