import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

// Spec §15 metrics, one registry per app (tests build many apps in one process). Every label
// takes values from a fixed set (status codes, contract codes, route templates, job names), never
// from request input, so a flood of random payloads cannot grow the series count.

const SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const BATCH_SIZES = [1, 2, 5, 10, 20, 50, 100, 200, 500];

export class Metrics {
  readonly registry = new Registry();
  private readonly registers = [this.registry];

  readonly ingestRequests = this.counter(
    "didban_ingest_requests_total",
    "Ingest requests by HTTP status and error code (empty code = 200).",
    ["status", "code"],
  );
  readonly ingestDuration = this.histogram(
    "didban_ingest_request_duration_seconds",
    "Ingest request latency, receive to response (200 = committed to PostgreSQL).",
    [],
    SECONDS,
  );
  readonly ingestEvents = this.counter(
    "didban_ingest_events_total",
    "Events by outcome: accepted (incl. filtered), duplicate, rejected (by event rejection code).",
    ["outcome", "code"],
  );
  readonly ingestFiltered = this.counter(
    "didban_ingest_filtered_total",
    "Events or properties dropped by a filter, by Data Health code (bot, internal, PII, ...).",
    ["code"],
  );
  readonly ingestUnavailable = this.counter(
    "didban_ingest_unavailable_total",
    "Ingest 503s by cause: SQLSTATE (57014 timeout, 55P03 lock, 40P01 deadlock, ...) or driver code.",
    ["cause"],
  );
  readonly batchSize = this.histogram(
    "didban_ingest_batch_size",
    "Events per accepted-for-processing batch.",
    [],
    BATCH_SIZES,
  );
  readonly rateLimited = this.counter(
    "didban_rate_limit_rejections_total",
    "Requests refused by a rate limit or quota, by bucket.",
    ["bucket"],
  );
  readonly statsDuration = this.histogram(
    "didban_stats_request_duration_seconds",
    "Stats request latency by endpoint (route template; cache hits included).",
    ["endpoint", "status"],
    SECONDS,
  );
  readonly txDuration = this.histogram(
    "didban_db_transaction_duration_seconds",
    "Transaction latency from BEGIN to COMMIT/ROLLBACK, by mode and outcome.",
    ["mode", "outcome"],
    SECONDS,
  );
  readonly poolWait = this.histogram(
    "didban_db_pool_wait_seconds",
    "Time a transaction waited for a pool connection (includes the BEGIN round trip).",
    [],
    SECONDS,
  );
  readonly poolTransactions = this.gauge(
    "didban_db_pool_transactions",
    "Transactions holding a pool connection (active) or queued for one (waiting).",
    ["state"],
  );
  readonly poolMax = this.gauge("didban_db_pool_max", "Configured pool size (DB_POOL_MAX).", []);
  readonly jobRowsDeleted = this.counter(
    "didban_job_rows_deleted_total",
    "Rows deleted by jobs run in this process (retention, data_deletion).",
    ["job"],
  );

  constructor() {
    // process_resident_memory_bytes, nodejs_eventloop_lag_seconds, heap and GC metrics.
    collectDefaultMetrics({ register: this.registry });
  }

  private counter<L extends string>(name: string, help: string, labelNames: L[]) {
    return new Counter({ name, help, labelNames, registers: this.registers });
  }

  private gauge<L extends string>(name: string, help: string, labelNames: L[]) {
    return new Gauge({ name, help, labelNames, registers: this.registers });
  }

  private histogram<L extends string>(name: string, help: string, labels: L[], buckets: number[]) {
    return new Histogram({ name, help, labelNames: labels, buckets, registers: this.registers });
  }
}
