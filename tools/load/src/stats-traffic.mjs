// Concurrent stats reads for the `mixed` scenario: the public share view (same report code, gate
// and cache as the dashboard; no session to fake). Ranges vary so some requests miss the cache.
import { createHash, randomBytes } from "node:crypto";

const REPORTS = ["overview", "timeseries", "pages", "sources", "devices", "events"];
const HOUR = 3_600_000;

export async function seedShareToken(sql, projectId) {
  const token = `dsh_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest();
  await sql`INSERT INTO share_links (project_id, label, token_hash)
            VALUES (${projectId}, 'load test', ${hash})`;
  return token;
}

export function statsTraffic(token) {
  let n = 0;
  return () => {
    n += 1;
    const to = new Date(Math.ceil(Date.now() / HOUR) * HOUR);
    const from = new Date(to.getTime() - (1 + (n % 24)) * HOUR); // 24 distinct windows
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    const report = REPORTS[n % REPORTS.length];
    return {
      method: "GET",
      path: `/api/v1/share/stats/${report}?${query}`,
      headers: { "x-share-token": token },
    };
  };
}
