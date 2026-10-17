import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";
import { AppError } from "./app-error.js";

// Fastify's own JSON parser (prototype-poisoning checks on) with a stable error: Nest would turn
// Fastify's parse error into a generic 400, but ingestion promises INVALID_JSON (spec §6.5).
export function useJsonBodyParser(app: NestFastifyApplication, bodyLimit: number): void {
  const parse = app.getHttpAdapter().getInstance().getDefaultJsonParser("error", "error");
  app.useBodyParser<RawServerDefault>("application/json", { bodyLimit }, (request, body, done) => {
    parse(request, body.toString("utf8"), (error, value) => {
      if (error) done(new AppError(400, "INVALID_JSON", "Body is not valid JSON"), undefined);
      else done(null, value);
    });
  });
}
