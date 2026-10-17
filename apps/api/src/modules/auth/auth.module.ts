import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
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
    { provide: LoginLimiter, useFactory: () => new LoginLimiter() },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
