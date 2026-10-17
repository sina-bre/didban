import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import type { Permission } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { authorize } from "../access/authorize.js";
import { REQUIRED_PERMISSION } from "../access/requires.decorator.js";
import { AuthSessionRepository, TOUCH_INTERVAL_MS } from "./auth-session.repository.js";
import { IS_PUBLIC } from "./public.decorator.js";
import { cookieName, readCookie } from "./session-cookie.js";
import { hashSessionToken, isWellFormedToken } from "./session-token.js";

const unauthenticated = () => new AppError(401, "UNAUTHENTICATED", "Authentication required");

/**
 * The one global guard (spec §11): every route needs a valid session unless it is `@Public()`,
 * then its `@Requires(...)` permission is checked against the principal's AccessScope.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AuthSessionRepository,
    @Inject(ENV) private readonly env: Env,
    @Inject(SQL) private readonly sql: Sql,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = readCookie(request.headers.cookie, cookieName(this.env));
    if (!isWellFormedToken(token)) throw unauthenticated();
    const principal = await this.sessions.findValid(hashSessionToken(token));
    if (!principal) throw unauthenticated();
    if (Date.now() - principal.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.sessions.touch(principal.sessionId);
    }
    request.principal = principal;
    const permission = this.reflector.getAllAndOverride<Permission>(REQUIRED_PERMISSION, targets);
    await authorize(this.sql, request, principal, permission);
    return true;
  }
}
