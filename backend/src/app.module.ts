import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { CrmModule } from "./crm/crm.module";
import { EmailModule } from "./email/email.module";
import { KingModule } from "./king/king.module";
import { LeadsModule } from "./leads/leads.module";
import { ProjectsModule } from "./projects/projects.module";
import { TradingModule } from "./trading/trading.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProjectsModule,
    AiModule,
    LeadsModule,
    CrmModule,
    EmailModule,
    TradingModule,
    KingModule,
  ],
})
export class AppModule {}
