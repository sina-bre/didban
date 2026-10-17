import { Controller, Get, HttpCode, Inject } from "@nestjs/common";
import { SQL, type Sql } from "../../db/db.module.js";
import { AppError } from "../../http/app-error.js";
import { Public } from "../auth/public.decorator.js";
import { ShutdownState } from "./shutdown-state.js";

const DB_CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Spec §15: live = process up; ready = DB answers within 2 s and we are not shutting down.
@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly shutdown: ShutdownState,
    @Inject(SQL) private readonly sql: Sql,
  ) {}

  @Get("live")
  @HttpCode(200)
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @HttpCode(200)
  async ready() {
    if (this.shutdown.isShuttingDown) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Shutting down");
    }
    try {
      await withTimeout(this.sql`SELECT 1`.execute(), DB_CHECK_TIMEOUT_MS);
    } catch {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Database unavailable");
    }
    return { status: "ready" };
  }
}
