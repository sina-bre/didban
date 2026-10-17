import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./app-error.js";

// Fixed public messages: never echo the request (URLs can carry tokens; spec §11 needs identical
// bodies for "missing" and "not yours").
const HTTP_ERRORS: Record<number, [code: string, message: string]> = {
  400: ["BAD_REQUEST", "Bad request"],
  401: ["UNAUTHENTICATED", "Authentication required"],
  403: ["FORBIDDEN", "Not allowed"],
  404: ["NOT_FOUND", "Resource not found"],
  405: ["METHOD_NOT_ALLOWED", "Method not allowed"],
  413: ["PAYLOAD_TOO_LARGE", "Payload too large"],
  415: ["UNSUPPORTED_MEDIA_TYPE", "Unsupported media type"],
  429: ["RATE_LIMITED", "Too many requests"],
};
const INTERNAL: [string, string] = ["INTERNAL_ERROR", "Internal error"];

type Mapped = { status: number; code: string; message: string; headers: Record<string, string> };

function map(error: unknown): Mapped {
  if (error instanceof AppError) return { ...error, message: error.message };
  const raw =
    error instanceof HttpException
      ? error.getStatus()
      : Number((error as { statusCode?: number })?.statusCode) || 500;
  const known = HTTP_ERRORS[raw];
  const [code, message] = known ?? INTERNAL;
  return { status: known ? raw : 500, code, message, headers: {} };
}

/** One error body everywhere: `{ error: { code, message, requestId } }`. No stacks, no SQL. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const mapped = map(error);
    if (mapped.status === 500) request.log.error({ err: error }, "unhandled error");
    reply
      .headers(mapped.headers)
      .status(mapped.status)
      .send({ error: { code: mapped.code, message: mapped.message, requestId: request.id } });
  }
}
