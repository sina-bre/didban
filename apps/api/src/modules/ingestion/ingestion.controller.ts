import { Body, Controller, Headers, HttpCode, Options, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Public } from "../auth/public.decorator.js";
import { IngestBatch, type IngestResult } from "./ingest-batch.js";

// Spec §6.1. Public on purpose: the write key in the body (or `X-Write-Key`) is the credential,
// checked by PrepareBatch. CORS headers come from the `ingest-cors` hook, also on errors.
@Public()
@Controller("ingest")
export class IngestionController {
  constructor(private readonly ingest: IngestBatch) {}

  /** Spec §6.4: 200 means committed to PostgreSQL. */
  @Post("batch")
  @HttpCode(200)
  async batch(
    @Body() body: unknown,
    @Headers("x-write-key") writeKeyHeader: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() request: FastifyRequest,
  ): Promise<IngestResult & { requestId: string }> {
    const input = { body, writeKeyHeader, origin, userAgent, ip: request.ip };
    const result = await this.ingest.execute(input);
    return { ...result, requestId: request.id };
  }

  @Options("batch")
  @HttpCode(204)
  preflight(): void {}
}
