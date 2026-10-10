import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { CrmController } from "./crm.controller";

@Module({
  imports: [LeadsModule],
  controllers: [CrmController],
})
export class CrmModule {}
