import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { AiModule } from "../ai/ai.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AiModule, BillingModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
