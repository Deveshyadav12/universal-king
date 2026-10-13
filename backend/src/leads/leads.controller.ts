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
import { AutoDiscoveryService } from "./auto-discovery.service";
import { Roles } from "../auth/auth.decorators";

@Roles("admin")
@Controller("leads")
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
    private readonly discoveryService: DiscoveryService,
    private readonly autoDiscoveryService: AutoDiscoveryService,
  ) {}

  // Legacy discovery endpoints (kept for backward compatibility)
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

  // New auto-discovery endpoints
  @Get("auto-discovery/status")
  autoDiscoveryStatus() {
    return this.autoDiscoveryService.getStatus();
  }

  @Get("ai/status")
  async aiStatus() {
    try {
      const health = await this.aiService.getHealth();
      return {
        ...health,
        offline: false,
      };
    } catch (error) {
      return {
        success: false,
        service: "hexawave-ai",
        status: "offline",
        version: "unknown",
        workspaces: 0,
        offline: true,
      };
    }
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

  // AI-powered batch processing
  @Post("ai/process-all")
  async processAllWithAI() {
    const leads = this.leadsService.list();
    const results = [];
    
    for (const lead of leads) {
      try {
        const scored = await this.aiService.scoreLead(lead);
        const updated = this.leadsService.updateScore(
          lead.id,
          scored.score,
          scored.reasons,
          scored.qualification,
        );
        results.push({ success: true, lead: updated });
      } catch (error) {
        results.push({ success: false, leadId: lead.id, error: String(error) });
      }
    }
    
    return {
      total: leads.length,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  // Fast bulk operations
  @Post("bulk/score")
  async bulkScore(@Body() body: { leadIds: string[] }) {
    const results = [];
    
    for (const leadId of body.leadIds) {
      try {
        const lead = this.leadsService.get(leadId);
        const scored = await this.aiService.scoreLead(lead);
        const updated = this.leadsService.updateScore(
          leadId,
          scored.score,
          scored.reasons,
          scored.qualification,
        );
        results.push({ success: true, lead: updated });
      } catch (error) {
        results.push({ success: false, leadId, error: String(error) });
      }
    }
    
    return {
      total: body.leadIds.length,
      processed: results.filter(r => r.success).length,
      results,
    };
  }
}
