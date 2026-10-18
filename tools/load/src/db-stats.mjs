// What the run did to PostgreSQL: rows written for the project, commits/rollbacks/deadlocks
// (pg_stat_database deltas), and samples of busy API connections and lock waiters.

export async function snapshot(sql, projectId) {
  const [db] = await sql`
    SELECT xact_commit::int8 AS commits, xact_rollback::int8 AS rollbacks, deadlocks::int8 AS deadlocks
    FROM pg_stat_database WHERE datname = current_database()`;
  const [rows] = await sql`
    SELECT (SELECT count(*) FROM events WHERE project_id = ${projectId})::int8 AS events,
           (SELECT count(*) FROM visits WHERE project_id = ${projectId})::int8 AS visits`;
  return { ...db, ...rows };
}

export const delta = (before, after) =>
  Object.fromEntries(Object.keys(after).map((k) => [k, Number(after[k]) - Number(before[k])]));

/** Samples pg_stat_activity every 250 ms until `stop()`; returns max/avg busy + lock waiters. */
export function sampleActivity(sql) {
  const busy = [];
  const waiting = [];
  const blockedOn = {};
  let running = true;
  const loop = (async () => {
    while (running) {
      const [row] = await sql`
        SELECT count(*) FILTER (WHERE state <> 'idle')::int AS busy,
               count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database() AND usename = current_user AND pid <> pg_backend_pid()`;
      const blocked = await sql`
        SELECT left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 60) AS q, wait_event AS w
        FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      for (const b of blocked) blockedOn[`${b.w}: ${b.q}`] = (blockedOn[`${b.w}: ${b.q}`] ?? 0) + 1;
      busy.push(row.busy);
      waiting.push(row.waiting);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
  return async () => {
    running = false;
    await loop;
    const avg = (list) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
    return {
      busyMax: Math.max(0, ...busy),
      busyAvg: avg(busy),
      lockWaitMax: Math.max(0, ...waiting),
      lockWaitSamples: waiting.filter((n) => n > 0).length,
      samples: busy.length,
      blockedOn,
    };
  };
}
