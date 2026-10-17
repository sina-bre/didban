import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { SQL, type Sql } from "../db/db.module.js";
import { createApp } from "../http/create-app.js";
import { testEnv } from "./test-env.js";

export const ORIGIN = "http://localhost:5173";

/** A booted app plus helpers that send what the dashboard sends (same Origin, JSON). */
export async function startTestApp(envOverrides: Record<string, string> = {}) {
  const app: NestFastifyApplication = await createApp(testEnv(envOverrides));
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();

  const send = (options: InjectOptions) => fastify.inject(options);
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    send({
      method: "POST",
      url: `/api/v1${url}`,
      payload: JSON.stringify(body),
      headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    });
  const get = (url: string, headers: Record<string, string> = {}) =>
    send({ method: "GET", url: `/api/v1${url}`, headers });

  return { app, sql: app.get<Sql>(SQL), send, post, get, close: () => app.close() };
}

/** `sid=<token>` from a login response, ready for a `cookie` header. */
export function sessionFrom(response: LightMyRequestResponse): string {
  const header = String(response.headers["set-cookie"] ?? "");
  const match = /^sid=([^;]*)/.exec(header);
  if (!match?.[1]) throw new Error(`no session cookie in: ${header}`);
  return `sid=${match[1]}`;
}
