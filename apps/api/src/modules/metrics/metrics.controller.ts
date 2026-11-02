import { createHash, timingSafeEqual } from "node:crypto";
import { Controller, Get, Header, Headers, Inject, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { Registry } from "prom-client";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../http/app-error.js";
import { Public } from "../auth/public.decorator.js";
import { Metrics } from "./metrics.js";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Spec §15 + ADR 0049: `GET /metrics`, outside `/api/v1` (Caddy and Nginx forward only `/api/*`,
// so it is never public) and behind `Authorization: Bearer $METRICS_TOKEN`. No session: a
// scraper is not a user. Without a token configured the route answers 404 like a missing one.
@Public()
@Controller("metrics")
export class MetricsController {
  private readonly token: Buffer | undefined;

  constructor(
    private readonly metrics: Metrics,
    @Inject(ENV) env: Env,
  ) {
    this.token = env.METRICS_TOKEN ? digest(env.METRICS_TOKEN) : undefined;
  }

  @Get()
  @Header("cache-control", "no-store")
  async scrape(
    @Headers("authorization") authorization: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    if (!this.token) throw new AppError(404, "NOT_FOUND", "Resource not found");
    const presented = digest(authorization?.match(/^Bearer (\S+)$/)?.[1] ?? "");
    if (!timingSafeEqual(presented, this.token)) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required", {
        "www-authenticate": "Bearer",
      });
    }
    const body = await this.metrics.registry.metrics();
    reply.type(Registry.PROMETHEUS_CONTENT_TYPE); // only on success: errors are JSON
    return body;
  }
}
