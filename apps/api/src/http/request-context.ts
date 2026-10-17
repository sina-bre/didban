import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";

// Request metadata for audit rows (request ID, client IP), the way a logger carries a correlation
// ID. Only metadata lives here: who acts and on what is always passed explicitly (ADR 0022).

export type RequestMeta = { requestId: string; ip: string };

const storage = new AsyncLocalStorage<RequestMeta>();

/** `undefined` outside an HTTP request (CLI commands, tests calling use cases directly). */
export const currentRequestMeta = (): RequestMeta | undefined => storage.getStore();

/** First `onRequest` hook: everything after it in this request runs inside the context. */
export function requestContextHook(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  storage.run({ requestId: request.id, ip: request.ip }, done);
}
