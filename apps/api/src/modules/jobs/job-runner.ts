import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import { Metrics } from "../metrics/metrics.js";
import { type JobContext, JobStopped } from "./chunked-delete.js";
import { runDeletions } from "./deletion-job.js";
import { withJobLock } from "./job-lock.js";
import { isDue, type JobName, recordRun } from "./job-runs.js";
import { runRetention } from "./retention-job.js";

// ADR 0045: an in-process runner, no queue (spec §20). Once a minute, the process holding the
// advisory lock works the open deletion requests, then runs retention when its last success is
// older than 23 h ("nightly" without a wall-clock schedule). Shutdown waits for the current chunk.

const TICK_MS = 60_000;
const PAUSE_MS = 100;
const RETENTION_EVERY_HOURS = 23;

@Injectable()
export class JobRunner implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(JobRunner.name);
  private timer: NodeJS.Timeout | undefined;
  private current: Promise<void> | undefined;
  private stopping = false;

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
    private readonly metrics: Metrics,
  ) {}

  onModuleInit(): void {
    if (this.env.JOBS === "off") return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearInterval(this.timer);
    await this.current;
  }

  /** One pass; a no-op while the previous pass still runs. Never throws. */
  tick(): Promise<void> {
    this.current ??= this.runOnce().finally(() => {
      this.current = undefined;
    });
    return this.current;
  }

  private async runOnce(): Promise<void> {
    const ctx: JobContext = {
      sql: this.sql,
      chunk: this.env.JOB_DELETE_CHUNK,
      pauseMs: PAUSE_MS,
      stopping: () => this.stopping,
    };
    try {
      await withJobLock(this.sql, async () => {
        await this.run(ctx, "data_deletion", () => runDeletions(ctx));
        if (await isDue(this.sql, "retention", RETENTION_EVERY_HOURS)) {
          await this.run(ctx, "retention", () => runRetention(ctx));
        }
      });
    } catch (error) {
      if (!(error instanceof JobStopped)) this.logger.error(`jobs: ${(error as Error).message}`);
    }
  }

  private async run(ctx: JobContext, job: JobName, work: () => Promise<number>): Promise<void> {
    const started = Date.now();
    const rows = await recordRun(ctx.sql, job, work);
    this.metrics.jobRowsDeleted.inc({ job }, rows);
    if (rows > 0 || job === "retention") {
      this.logger.log(`${job}: ${rows} rows deleted in ${Date.now() - started} ms`);
    }
  }
}
