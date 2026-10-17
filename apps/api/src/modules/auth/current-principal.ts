import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { SessionPrincipal } from "./auth-session.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    principal?: SessionPrincipal;
  }
}

/** The session resolved by SessionGuard. Only valid on non-public routes. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPrincipal => {
    const principal = context.switchToHttp().getRequest<FastifyRequest>().principal;
    if (!principal) throw new Error("CurrentPrincipal used on a route without a session");
    return principal;
  },
);
