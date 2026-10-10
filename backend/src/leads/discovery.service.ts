import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  LEAD_SIZE_SEGMENTS,
  type CreateLeadInput,
  type LeadSizeSegment,
  LeadsService,
} from "./leads.service";

const DAILY_LEAD_LIMIT = 30;
const DAILY_QUERY_LIMIT = LEAD_SIZE_SEGMENTS.length * 2;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INDUSTRIES = ["software", "technology", "healthcare", "manufacturing"];

interface SearchResult {
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
}

interface SearchResponse {
  error?: unknown;
  organic_results?: unknown;
}

export interface DiscoveryTargets {
  industries: string[];
  sizeSegments: LeadSizeSegment[];
}

export interface DiscoveryRun {
  status: "idle" | "running" | "completed" | "failed" | "stopped";
  startedAt: string | null;
  completedAt: string | null;
  added: number;
  skipped: number;
  error: string | null;
}

@Injectable()
export class DiscoveryService implements OnModuleDestroy {
  private scheduleEnabled =
    process.env.HEXAWAVE_DISCOVERY_DAILY_ENABLED === "true" &&
    Boolean(process.env.SERPAPI_API_KEY);
  private targets: DiscoveryTargets = {
    industries: DEFAULT_INDUSTRIES,
    sizeSegments: [...LEAD_SIZE_SEGMENTS],
  };
  private nextRunAt: string | null = null;
  private runState: DiscoveryRun = {
    status: "idle",
    startedAt: null,
    completedAt: null,
    added: 0,
    skipped: 0,
    error: null,
  };
  private dailyDate = new Date().toISOString().slice(0, 10);
  private dailyQueriesUsed = 0;
  private dailyLeadsAdded = 0;
  private dailyTimer: ReturnType<typeof setTimeout> | undefined;
  private activeController: AbortController | undefined;

  constructor(private readonly leadsService: LeadsService) {
    if (this.scheduleEnabled) this.scheduleNextRun();
  }

  onModuleDestroy(): void {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
    this.activeController?.abort();
  }

  status() {
    this.resetDailyCountersIfNeeded();
    return {
      provider: "SerpApi Google Search",
      providerConfigured: Boolean(process.env.SERPAPI_API_KEY),
      scheduleEnabled: this.scheduleEnabled,
      schedulePersistence: "in-memory; resets on backend restart",
      dailyLeadLimit: DAILY_LEAD_LIMIT,
      dailyLeadsAdded: this.dailyLeadsAdded,
      dailyQueryLimit: DAILY_QUERY_LIMIT,
      dailyQueriesUsed: this.dailyQueriesUsed,
      nextRunAt: this.nextRunAt,
      targets: this.targets,
      lastRun: this.runState,
    };
  }

  updateSchedule(enabled: unknown, targets?: Partial<DiscoveryTargets>) {
    if (typeof enabled !== "boolean") {
      throw new BadRequestException("enabled must be a boolean.");
    }
    if (enabled && !process.env.SERPAPI_API_KEY) {
      throw new ServiceUnavailableException(
        "Set SERPAPI_API_KEY in the backend environment before enabling daily discovery.",
      );
    }
    if (targets) this.targets = this.validateTargets(targets);
    this.scheduleEnabled = enabled;
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
    this.dailyTimer = undefined;
    this.nextRunAt = null;
    if (enabled) this.scheduleNextRun();
    return this.status();
  }

  async runNow(targets?: Partial<DiscoveryTargets>) {
    if (targets) this.targets = this.validateTargets(targets);
    return this.executeRun(false);
  }

  stop() {
    if (this.runState.status !== "running") {
      throw new ConflictException("No lead discovery run is currently active.");
    }
    this.activeController?.abort();
    return { success: true, status: "stopping" as const };
  }

  private async executeRun(scheduled: boolean) {
    if (this.runState.status === "running") {
      throw new ConflictException("A lead discovery run is already in progress.");
    }
    this.resetDailyCountersIfNeeded();
    if (!process.env.SERPAPI_API_KEY) {
      throw new ServiceUnavailableException(
        "Google Search discovery is not configured. Set SERPAPI_API_KEY in the backend environment.",
      );
    }
    if (this.dailyQueriesUsed >= DAILY_QUERY_LIMIT) {
      throw new ConflictException("The daily Google Search query limit has been reached.");
    }
    if (this.dailyLeadsAdded >= DAILY_LEAD_LIMIT) {
      throw new ConflictException("The daily lead discovery cap has been reached.");
    }

    const controller = new AbortController();
    this.activeController = controller;
    this.runState = {
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      added: 0,
      skipped: 0,
      error: null,
    };

    try {
      const addedDomains = new Set<string>();
      for (const sizeSegment of this.targets.sizeSegments) {
        for (const market of ["India", "International"] as const) {
          if (controller.signal.aborted) break;
          if (
            this.dailyQueriesUsed >= DAILY_QUERY_LIMIT ||
            this.dailyLeadsAdded + this.runState.added >= DAILY_LEAD_LIMIT
          ) {
            break;
          }
          const industry = this.targets.industries[
            this.dailyQueriesUsed % this.targets.industries.length
          ];
          const query = this.buildQuery(sizeSegment, industry, market);
          this.dailyQueriesUsed += 1;
          const results = await this.search(query, market, controller.signal);

          for (const result of results) {
            if (
              controller.signal.aborted ||
              this.dailyLeadsAdded + this.runState.added >= DAILY_LEAD_LIMIT
            ) {
              break;
            }
            const candidate = this.toLeadInput(result, sizeSegment, market, industry);
            if (!candidate) {
              this.runState.skipped += 1;
              continue;
            }
            const domain = new URL(candidate.website!).hostname.toLowerCase().replace(/^www\./, "");
            if (addedDomains.has(domain) || this.leadsService.hasWebsiteDomain(candidate.website!)) {
              this.runState.skipped += 1;
              continue;
            }
            try {
              this.leadsService.create(candidate);
              addedDomains.add(domain);
              this.runState.added += 1;
              this.dailyLeadsAdded += 1;
            } catch (error) {
              if (!(error instanceof ConflictException)) throw error;
              this.runState.skipped += 1;
            }
          }
        }
      }
      this.runState.status = controller.signal.aborted ? "stopped" : "completed";
      this.runState.completedAt = new Date().toISOString();
      if (this.runState.status === "stopped") this.runState.error = "Discovery run was stopped.";
      return {
        success: !controller.signal.aborted,
        scheduled,
        ...this.runState,
        dailyLeadsAdded: this.dailyLeadsAdded,
        dailyLeadLimit: DAILY_LEAD_LIMIT,
        dailyQueriesUsed: this.dailyQueriesUsed,
        dailyQueryLimit: DAILY_QUERY_LIMIT,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        this.runState.status = "stopped";
        this.runState.completedAt = new Date().toISOString();
        this.runState.error = "Discovery run was stopped.";
        return {
          success: false,
          scheduled,
          ...this.runState,
          dailyLeadsAdded: this.dailyLeadsAdded,
          dailyLeadLimit: DAILY_LEAD_LIMIT,
          dailyQueriesUsed: this.dailyQueriesUsed,
          dailyQueryLimit: DAILY_QUERY_LIMIT,
        };
      }
      this.runState.status = "failed";
      this.runState.completedAt = new Date().toISOString();
      this.runState.error = error instanceof Error ? error.message : "Lead discovery failed.";
      throw error;
    } finally {
      this.activeController = undefined;
    }
  }

  private buildQuery(size: LeadSizeSegment, industry: string, market: "India" | "International") {
    const sizeTerm: Record<LeadSizeSegment, string> = {
      small: "small business OR startup",
      medium: "mid-sized company",
      large: "large enterprise",
    };
    const geography = market === "India" ? "India" : "international";
    return `${industry} companies ${sizeTerm[size]} ${geography} official website`;
  }

  private async search(query: string, market: "India" | "International", signal: AbortSignal) {
    const params = new URLSearchParams({
      engine: "google",
      api_key: process.env.SERPAPI_API_KEY!,
      q: query,
      num: "10",
      ...(market === "India" ? { gl: "in", hl: "en" } : { hl: "en" }),
    });
    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Google Search provider returned HTTP ${response.status}. Check the SerpApi account and quota.`,
      );
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new ServiceUnavailableException("Google Search provider returned an invalid response.");
    }
    const data = payload as SearchResponse;
    if (typeof data.error === "string" && data.error) {
      throw new ServiceUnavailableException(`Google Search provider error: ${data.error.slice(0, 300)}`);
    }
    if (data.organic_results === undefined) return [];
    if (!Array.isArray(data.organic_results)) {
      throw new ServiceUnavailableException("Google Search provider returned invalid search results.");
    }
    return data.organic_results as SearchResult[];
  }

  private toLeadInput(
    result: SearchResult,
    sizeSegment: LeadSizeSegment,
    market: "India" | "International",
    industry: string,
  ): CreateLeadInput | undefined {
    if (
      typeof result.title !== "string" ||
      typeof result.link !== "string" ||
      typeof result.snippet !== "string"
    ) {
      return undefined;
    }
    let url: URL;
    try {
      url = new URL(result.link);
    } catch {
      return undefined;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "google.com" || host.endsWith(".google.com")) return undefined;
    const title = result.title.trim().slice(0, 160);
    if (!title) return undefined;
    return {
      companyName: title,
      website: url.origin,
      source: "SerpApi Google Search",
      sourceUrl: url.toString().slice(0, 2048),
      description: result.snippet.trim().slice(0, 1000),
      industry,
      location: market === "India"
        ? "India search target (verify)"
        : "International search (location unverified)",
      targetSizeSegment: sizeSegment,
    };
  }

  private validateTargets(targets: Partial<DiscoveryTargets>): DiscoveryTargets {
    const industries = targets.industries ?? this.targets.industries;
    const sizeSegments = targets.sizeSegments ?? this.targets.sizeSegments;
    if (
      !Array.isArray(industries) ||
      industries.length < 1 ||
      industries.length > 8 ||
      industries.some((value) => typeof value !== "string" || !value.trim() || value.length > 80)
    ) {
      throw new BadRequestException("Provide between 1 and 8 industry search terms, each up to 80 characters.");
    }
    if (
      !Array.isArray(sizeSegments) ||
      sizeSegments.length < 1 ||
      sizeSegments.some(
        (value) => typeof value !== "string" || !LEAD_SIZE_SEGMENTS.includes(value as LeadSizeSegment),
      )
    ) {
      throw new BadRequestException("Choose at least one supported company-size segment.");
    }
    return {
      industries: Array.from(new Set(industries.map((value) => value.trim()))),
      sizeSegments: Array.from(new Set(sizeSegments)) as LeadSizeSegment[],
    };
  }

  private scheduleNextRun() {
    this.nextRunAt = new Date(Date.now() + DAILY_INTERVAL_MS).toISOString();
    this.dailyTimer = setTimeout(() => {
      void this.runScheduled();
    }, DAILY_INTERVAL_MS);
    this.dailyTimer.unref();
  }

  private async runScheduled() {
    try {
      this.resetDailyCountersIfNeeded();
      await this.executeRun(true);
    } catch (error) {
      this.runState.status = "failed";
      this.runState.completedAt = new Date().toISOString();
      this.runState.error = error instanceof Error ? error.message : "Scheduled discovery failed.";
    } finally {
      if (this.scheduleEnabled) this.scheduleNextRun();
    }
  }

  private resetDailyCountersIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyDate) {
      this.dailyDate = today;
      this.dailyQueriesUsed = 0;
      this.dailyLeadsAdded = 0;
    }
  }
}
