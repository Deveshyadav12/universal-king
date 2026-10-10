import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DiscoveryService } from "./discovery.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

@Module({
  imports: [AiModule],
  controllers: [LeadsController],
  providers: [LeadsService, DiscoveryService],
  exports: [LeadsService, DiscoveryService],
})
export class LeadsModule {}
