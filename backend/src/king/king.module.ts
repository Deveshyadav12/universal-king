import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { BillingModule } from "../billing/billing.module";
import { ProjectsModule } from "../projects/projects.module";
import { BillingController } from "../billing/billing.controller";
import { KingController } from "./king.controller";
import { KingService } from "./king.service";

@Module({
  imports: [AiModule, ProjectsModule, BillingModule],
  controllers: [KingController, BillingController],
  providers: [KingService],
})
export class KingModule {}
