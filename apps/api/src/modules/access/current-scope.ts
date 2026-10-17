import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AccessScope } from "../../domain/permissions.js";

/** The AccessScope the guard loaded for this request. Only valid on non-public routes. */
export const CurrentScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessScope => {
    const scope = context.switchToHttp().getRequest<FastifyRequest>().scope;
    if (!scope) throw new Error("CurrentScope used on a route without a session");
    return scope;
  },
);
