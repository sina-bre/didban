import {
  type ChangePasswordRequest,
  changePasswordRequestSchema,
  type LoginRequest,
  loginRequestSchema,
  type MeResponse,
} from "@didban/contracts";
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { Requires } from "../access/requires.decorator.js";
import { AuthSessionRepository, type SessionPrincipal } from "./auth-session.repository.js";
import { ChangePassword } from "./change-password.js";
import { CurrentPrincipal } from "./current-principal.js";
import { Login } from "./login.js";
import { Public } from "./public.decorator.js";
import { clearedSessionCookie, cookieName, readCookie, sessionCookie } from "./session-cookie.js";

type Reply = FastifyReply;
const userOf = (p: SessionPrincipal) => ({
  id: p.userId,
  email: p.email,
  isPlatformAdmin: p.isPlatformAdmin,
});

@Controller("auth")
export class AuthController {
  constructor(
    private readonly login: Login,
    private readonly changePassword: ChangePassword,
    private readonly sessions: AuthSessionRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async signIn(
    @Body(new ZodPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<MeResponse> {
    const { token, user } = await this.login.execute({
      ...body,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
      currentToken: readCookie(request.headers.cookie, cookieName(this.env)),
    });
    reply.header("set-cookie", sessionCookie(this.env, token));
    return { user };
  }

  @Requires("self")
  @Get("me")
  me(@CurrentPrincipal() principal: SessionPrincipal): MeResponse {
    return { user: userOf(principal) };
  }

  @Requires("self")
  @Post("logout")
  @HttpCode(204)
  async logout(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Res({ passthrough: true }) reply: Reply,
  ) {
    await this.sessions.delete(principal.sessionId);
    reply.header("set-cookie", clearedSessionCookie(this.env));
  }

  @Requires("self")
  @Post("logout-all")
  @HttpCode(204)
  async logoutAll(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Res({ passthrough: true }) reply: Reply,
  ) {
    await this.sessions.deleteAllForUser(principal.userId);
    reply.header("set-cookie", clearedSessionCookie(this.env));
  }

  @Requires("self")
  @Post("password")
  @HttpCode(204)
  async password(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body(new ZodPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @Req() request: FastifyRequest,
  ) {
    await this.changePassword.execute({ principal, ...body, ip: request.ip });
  }
}
