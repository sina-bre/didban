// After each scenario: the API's own view (GET /metrics, ADR 0049), didban_* series without
// histogram buckets, so the result file shows what an operator's Prometheus would have seen.
export const METRICS_TOKEN = "load-test-metrics-token-0123456789abcdef";

export async function scrapeMetrics(base) {
  const res = await fetch(`${base}/metrics`, {
    headers: { authorization: `Bearer ${METRICS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`/metrics answered ${res.status}`);
  const lines = (await res.text()).split("\n");
  const keep = lines.filter(
    (l) => l.startsWith("didban_") && !l.includes("_bucket{") && !l.endsWith(" 0"),
  );
  return Object.fromEntries(
    keep.map((l) => [l.slice(0, l.lastIndexOf(" ")), Number(l.slice(l.lastIndexOf(" ") + 1))]),
  );
}
