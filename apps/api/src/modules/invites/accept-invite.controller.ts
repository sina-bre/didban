import {
  type AcceptInviteRequest,
  acceptInviteRequestSchema,
  type InvitePreview,
  type MeResponse,
  type PreviewInviteRequest,
  previewInviteRequestSchema,
} from "@didban/contracts";
import { Body, Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import { ZodPipe } from "../../http/zod-pipe.js";
import { Public } from "../auth/public.decorator.js";
import { cookieName, readCookie, sessionCookie } from "../auth/session-cookie.js";
import { AcceptInvite } from "./accept-invite.js";
import { previewInvite } from "./open-invite.js";

/** Public (spec §11 allowlist): the invite token is the credential. POST keeps it out of URLs. */
@Controller("auth/accept-invite")
export class AcceptInviteController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
    private readonly acceptInvite: AcceptInvite,
  ) {}

  @Public()
  @Post("preview")
  @HttpCode(200)
  preview(
    @Body(new ZodPipe(previewInviteRequestSchema)) body: PreviewInviteRequest,
  ): Promise<InvitePreview> {
    return previewInvite(this.sql, body.token);
  }

  @Public()
  @Post()
  @HttpCode(200)
  async accept(
    @Body(new ZodPipe(acceptInviteRequestSchema)) body: AcceptInviteRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MeResponse> {
    const { token, user } = await this.acceptInvite.execute({
      ...body,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
      currentToken: readCookie(request.headers.cookie, cookieName(this.env)),
    });
    reply.header("set-cookie", sessionCookie(this.env, token));
    return { user };
  }
}
