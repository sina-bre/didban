import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Metrics } from "../metrics/metrics.js";
import { AuthController } from "./auth.controller.js";
import { AuthSessionRepository } from "./auth-session.repository.js";
import { ChangePassword } from "./change-password.js";
import { Login } from "./login.js";
import { LoginLimiter } from "./login-limiter.js";
import { SessionGuard } from "./session.guard.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthSessionRepository,
    Login,
    ChangePassword,
    {
      provide: LoginLimiter,
      useFactory: (metrics: Metrics) =>
        new LoginLimiter(Date.now, () => metrics.rateLimited.inc({ bucket: "login" })),
      inject: [Metrics],
    },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
