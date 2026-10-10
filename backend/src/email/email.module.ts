import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { EmailController } from "./email.controller";
import { EmailService } from "./email.service";

@Module({
  imports: [LeadsModule],
  controllers: [EmailController],
  providers: [EmailService],
})
export class EmailModule {}
