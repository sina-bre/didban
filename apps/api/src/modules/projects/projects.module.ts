import { Module } from "@nestjs/common";
import { OrganizationProjectsController } from "./organization-projects.controller.js";
import { ProjectsController } from "./projects.controller.js";

@Module({ controllers: [ProjectsController, OrganizationProjectsController] })
export class ProjectsModule {}
