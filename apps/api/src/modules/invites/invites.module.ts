import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AcceptInviteController } from "./accept-invite.controller.js";
import { AcceptInvite } from "./accept-invite.js";
import { AdminInvitesController } from "./admin-invites.controller.js";
import { InvitesController } from "./invites.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [InvitesController, AdminInvitesController, AcceptInviteController],
  providers: [AcceptInvite],
})
export class InvitesModule {}
