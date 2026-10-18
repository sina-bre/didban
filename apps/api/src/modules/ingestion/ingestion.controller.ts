import { Body, Controller, Headers, HttpCode, Ip, Options, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { EnrichBatch } from "./enrich/enrich-batch.js";
import { ingestError } from "./ingest-error.js";
import { PrepareBatch } from "./prepare-batch.js";

// Spec §6.1. Public on purpose: the write key in the body (or `X-Write-Key`) is the credential,
// checked by PrepareBatch. CORS headers come from the `ingest-cors` hook, also on errors.
@Public()
@Controller("ingest")
export class IngestionController {
  constructor(
    private readonly prepare: PrepareBatch,
    private readonly enrich: EnrichBatch,
  ) {}

  @Post("batch")
  @HttpCode(200)
  async batch(
    @Body() body: unknown,
    @Headers("x-write-key") writeKeyHeader: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Ip() ip: string,
  ): Promise<never> {
    const batch = await this.prepare.execute({ body, writeKeyHeader, origin, ip });
    this.enrich.execute(batch, { ip, userAgent });
    // 200 means "committed to PostgreSQL" (spec §6.4). The event writer arrives in Stage 3c;
    // until then a valid batch is not stored, so it is not accepted either (ADR 0025).
    throw ingestError("SERVICE_UNAVAILABLE", "Event storage is not enabled");
  }

  @Options("batch")
  @HttpCode(204)
  preflight(): void {}
}
