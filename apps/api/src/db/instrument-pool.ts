import type { Metrics } from "../modules/metrics/metrics.js";
import type { Sql } from "./db.module.js";

// postgres.js keeps its pool queues private, so the pool is measured where we use it: every
// transaction (ingest writes, stats reads, jobs) goes through `sql.begin`. The wrapper counts
// transactions waiting for a connection and holding one, and times both phases.

type Begin = (options: string, fn: (tx: unknown) => unknown) => Promise<unknown>;

export function instrumentPool(sql: Sql, metrics: Metrics, poolMax: number): Sql {
  const begin = sql.begin.bind(sql) as unknown as Begin;
  const { poolTransactions: gauge, poolWait, txDuration } = metrics;
  metrics.poolMax.set(poolMax);
  gauge.set({ state: "active" }, 0);
  gauge.set({ state: "waiting" }, 0);

  const wrapped = (...args: unknown[]) => {
    const fn = args.pop() as (tx: unknown) => unknown;
    const options = typeof args[0] === "string" ? args[0] : "";
    const mode = options.includes("read only") ? "read_only" : "read_write";
    const queued = performance.now();
    let started = 0;
    gauge.inc({ state: "waiting" });
    const run = (tx: unknown) => {
      started = performance.now();
      gauge.dec({ state: "waiting" });
      gauge.inc({ state: "active" });
      poolWait.observe((started - queued) / 1000);
      return fn(tx);
    };
    const settle = (outcome: "commit" | "rollback") => {
      if (started === 0) return gauge.dec({ state: "waiting" });
      gauge.dec({ state: "active" });
      txDuration.observe({ mode, outcome }, (performance.now() - started) / 1000);
    };
    return begin(options, run).then(
      (value) => {
        settle("commit");
        return value;
      },
      (error: unknown) => {
        settle("rollback");
        throw error;
      },
    );
  };
  Object.assign(sql, { begin: wrapped });
  return sql;
}
