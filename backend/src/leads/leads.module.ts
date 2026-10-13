import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DatabaseModule } from "../database/database.module";
import { DiscoveryService } from "./discovery.service";
import { AutoDiscoveryService } from "./auto-discovery.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

@Module({
  imports: [AiModule, DatabaseModule],
  controllers: [LeadsController],
  providers: [LeadsService, DiscoveryService, AutoDiscoveryService],
  exports: [LeadsService, DiscoveryService, AutoDiscoveryService],
})
export class LeadsModule {}
