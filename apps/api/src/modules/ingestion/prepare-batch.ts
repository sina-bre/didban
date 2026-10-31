import { toOrigin } from "@didban/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError } from "../../http/app-error.js";
import { RecentRejections } from "../diagnostics/recent-rejections.js";
import type { ResolvedKey } from "../key-cache/write-key-cache.js";
import { isOverQuota } from "./check-quota.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { ingestError } from "./ingest-error.js";
import { IngestRateLimiter } from "./ingest-rate-limiter.js";
import { readBatchBody, writeKeyOf } from "./read-batch-body.js";
import { WriteKeyResolver } from "./resolve-write-key.js";
import { type ValidatedBatch, validateBatch } from "./validate-batch.js";

// Spec §7 steps 1–5 in order (step 1, the body limit, runs in Fastify before this). Every
// rejection after the key is known is counted for Data Health; the caller only sees the code.

export type IngestRequest = { body: unknown; writeKeyHeader?: string; origin?: string; ip: string };
export type PreparedBatch = ValidatedBatch & { key: ResolvedKey };

const secondsToUtcMidnight = (now: number) => Math.ceil((86_400_000 - (now % 86_400_000)) / 1000);

@Injectable()
export class PrepareBatch {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
    private readonly keys: WriteKeyResolver,
    private readonly limiter: IngestRateLimiter,
    private readonly diagnostics: IngestDiagnostics,
    private readonly recent: RecentRejections,
  ) {}

  async execute(request: IngestRequest): Promise<PreparedBatch> {
    const body = readBatchBody(request.body);
    const key = await this.keys.resolve(writeKeyOf(body, request.writeKeyHeader));
    try {
      this.checkOrigin(key, request.origin);
      await this.checkLimits(key, request.ip);
      const batch = validateBatch(body, Date.now());
      for (const rejection of batch.rejected) this.diagnostics.record(key, rejection.code);
      return { ...batch, key };
    } catch (error) {
      if (error instanceof AppError) {
        this.diagnostics.record(key, error.code);
        this.recent.add(key.environmentId, error.code, request.origin);
      }
      throw error;
    }
  }

  /** Browser keys only: a spam filter, not authentication (anyone can forge Origin outside a browser). */
  private checkOrigin(key: ResolvedKey, origin: string | undefined): void {
    if (key.kind !== "write_browser") return;
    const normalized = origin ? toOrigin(origin) : null;
    if (normalized && key.allowedOrigins.includes(normalized)) return;
    this.diagnostics.recordOrigin(key, origin ?? "(none)");
    throw ingestError("ORIGIN_NOT_ALLOWED", "Origin not allowed for this write key");
  }

  private async checkLimits(key: ResolvedKey, ip: string): Promise<void> {
    // Server keys send from the operator's own servers: one IP for everyone, so no IP bucket.
    const waits = [
      key.kind === "write_browser" ? this.limiter.take(`ip:${ip}`, this.env.INGEST_RATE_PER_IP) : 0,
      this.limiter.take(`key:${key.keyId}`, this.env.INGEST_RATE_PER_KEY),
    ];
    const wait = Math.max(...waits);
    if (wait > 0) {
      throw ingestError("RATE_LIMITED", "Too many requests", { "retry-after": String(wait) });
    }
    if (await isOverQuota(this.sql, key.organizationId)) {
      const retryAfter = String(secondsToUtcMidnight(Date.now()));
      throw ingestError("QUOTA_EXCEEDED", "Daily event quota exceeded", {
        "retry-after": retryAfter,
      });
    }
  }
}
