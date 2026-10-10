import { Controller, Get, Query } from "@nestjs/common";
import { LeadsService } from "../leads/leads.service";
import { Roles } from "../auth/auth.decorators";

@Roles("admin")
@Controller("crm")
export class CrmController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get("stats")
  stats() {
    return this.leadsService.stats();
  }

  @Get("audit")
  audit(@Query("limit") limit?: string) {
    const parsedLimit = limit === undefined ? 100 : Number(limit);
    return this.leadsService.audit(Number.isFinite(parsedLimit) ? parsedLimit : 100);
  }
}
