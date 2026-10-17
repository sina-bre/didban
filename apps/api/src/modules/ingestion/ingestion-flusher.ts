import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { flushDiagnostics } from "./flush-diagnostics.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { KeyUsage } from "./key-usage.js";

const FLUSH_INTERVAL_MS = 60_000;

/** Writes in-memory diagnostics and key usage once a minute, and once more on shutdown. */
@Injectable()
export class IngestionFlusher implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(IngestionFlusher.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly diagnostics: IngestDiagnostics,
    private readonly usage: KeyUsage,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  /** Never throws: a failed flush loses one minute of counters, not a request. */
  async flush(): Promise<void> {
    try {
      await flushDiagnostics(this.sql, this.diagnostics.drain());
      await this.usage.flush(this.sql);
    } catch (error) {
      this.logger.error(`ingestion flush failed: ${(error as Error).message}`);
    }
  }
}
