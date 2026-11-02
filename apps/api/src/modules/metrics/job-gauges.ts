import { Gauge, type Registry } from "prom-client";
import type { Sql } from "../../db/db.module.js";

// Spec §15 job last-success timestamps. Read from `job_runs` at scrape time, so every instance
// reports the cluster's state (only the lock holder runs a job). One query per scrape.

type JobRow = {
  job: string;
  lastStartedAt: Date | null;
  lastSuccessAt: Date | null;
  lastRows: string | null;
  failing: boolean;
};

const seconds = (at: Date | null) => (at ? at.getTime() / 1000 : 0);

export function registerJobGauges(registry: Registry, sql: Sql): void {
  let pending: Promise<JobRow[]> | undefined;
  const load = () => {
    pending ??= sql<JobRow[]>`
      SELECT job, last_started_at, last_success_at, last_rows::text, last_error IS NOT NULL AS failing
      FROM job_runs`
      .execute()
      .then((rows) => [...rows])
      .catch(() => [])
      .finally(() => setTimeout(() => (pending = undefined), 1000).unref());
    return pending;
  };
  const gauge = (name: string, help: string, value: (row: JobRow) => number) =>
    new Gauge({
      name,
      help,
      labelNames: ["job"],
      registers: [registry],
      async collect() {
        this.reset();
        for (const row of await load()) this.set({ job: row.job }, value(row));
      },
    });
  gauge(
    "didban_job_last_success_timestamp_seconds",
    "Unix time of the job's last successful run (0 = never).",
    (row) => seconds(row.lastSuccessAt),
  );
  gauge(
    "didban_job_last_started_timestamp_seconds",
    "Unix time the job last started (0 = never).",
    (row) => seconds(row.lastStartedAt),
  );
  gauge("didban_job_last_rows", "Rows deleted by the job's last successful run.", (row) =>
    Number(row.lastRows ?? 0),
  );
  gauge("didban_job_failing", "1 when the job's last run ended with an error.", (row) =>
    row.failing ? 1 : 0,
  );
}
