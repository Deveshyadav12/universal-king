import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AiService } from "../ai/ai.service";
import {
  CreateLeadInput,
  LEAD_STATUSES,
  LeadsService,
} from "./leads.service";
import { DiscoveryService, type DiscoveryTargets } from "./discovery.service";
import { Roles } from "../auth/auth.decorators";

@Roles("admin")
@Controller("leads")
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  @Get("discovery/status")
  discoveryStatus() {
    return this.discoveryService.status();
  }

  @Post("discovery/run")
  discover(@Body() body?: Partial<DiscoveryTargets>) {
    return this.discoveryService.runNow(body);
  }

  @Post("discovery/stop")
  stopDiscovery() {
    return this.discoveryService.stop();
  }

  @Patch("discovery/schedule")
  updateDiscoverySchedule(
    @Body() body: { enabled?: unknown; targets?: Partial<DiscoveryTargets> },
  ) {
    return this.discoveryService.updateSchedule(body?.enabled, body?.targets);
  }

  @Get()
  list(@Query("status") status?: string) {
    if (status && !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
      throw new BadRequestException("Unknown lead status.");
    }
    return this.leadsService.list(status as (typeof LEAD_STATUSES)[number] | undefined);
  }

  @Post()
  create(@Body() body: CreateLeadInput) {
    return this.leadsService.create(body);
  }

  @Get("audit")
  audit(@Query("limit") limit?: string) {
    const parsedLimit = limit === undefined ? 100 : Number(limit);
    return this.leadsService.audit(Number.isFinite(parsedLimit) ? parsedLimit : 100);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.leadsService.get(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<CreateLeadInput> & { status?: string },
  ) {
    return this.leadsService.update(id, body);
  }

  @Post(":id/score")
  async score(@Param("id") id: string) {
    const lead = this.leadsService.get(id);
    const scored = await this.aiService.scoreLead(lead);
    return this.leadsService.updateScore(
      id,
      scored.score,
      scored.reasons,
      scored.qualification,
    );
  }

  @Post(":id/suppress")
  suppress(@Param("id") id: string, @Body() body: { reason?: string }) {
    return this.leadsService.suppress(id, body?.reason ?? "manual");
  }

}
