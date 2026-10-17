import { Module } from "@nestjs/common";
import { AdminOwnersController } from "./admin-owners.controller.js";
import { UsersController } from "./users.controller.js";

@Module({ controllers: [UsersController, AdminOwnersController] })
export class UsersModule {}
