import { Module } from "@nestjs/common";
import { AdminOrganizationsController } from "./admin-organizations.controller.js";
import { OrganizationsController } from "./organizations.controller.js";

@Module({ controllers: [OrganizationsController, AdminOrganizationsController] })
export class OrganizationsModule {}
