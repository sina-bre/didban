import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../http/create-app.js";
import { testEnv } from "../../test-support/test-env.js";
import { ShutdownState } from "./shutdown-state.js";

let app: NestFastifyApplication;
const inject = (url: string) => app.getHttpAdapter().getInstance().inject({ method: "GET", url });

beforeEach(async () => {
  app = await createApp(testEnv());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterEach(() => app.close());

describe("health", () => {
  it("answers live and ready with a request id header", async () => {
    const live = await inject("/api/v1/health/live");
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });
    expect(live.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect((await inject("/api/v1/health/ready")).statusCode).toBe(200);
  });

  it("reports not ready once shutdown has started", async () => {
    app.get(ShutdownState).beforeApplicationShutdown();
    const ready = await inject("/api/v1/health/ready");
    expect(ready.statusCode).toBe(503);
    expect(ready.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("reports not ready when the database is unreachable", async () => {
    await app.close();
    app = await createApp(testEnv({ DATABASE_URL: "postgres://nobody:x@127.0.0.1:1/none" }));
    await app.init();
    const ready = await inject("/api/v1/health/ready");
    expect(ready.statusCode).toBe(503);
    expect(ready.json().error.message).toBe("Database unavailable");
  });

  it("returns the contract error body for unknown routes, with the same request id", async () => {
    const res = await inject("/api/v1/nope?token=secret123");
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe(res.headers["x-request-id"]);
    expect(JSON.stringify(body)).not.toMatch(/secret123|nope|stack|at .*\.ts/);
  });
});
