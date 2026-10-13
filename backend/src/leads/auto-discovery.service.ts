import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { AiService } from "../ai/ai.service";
import {
  LEAD_SIZE_SEGMENTS,
  type CreateLeadInput,
  type LeadSizeSegment,
  LeadsService,
} from "./leads.service";

const DAILY_LEAD_LIMIT = 100;
const CONURRENT_QUERIES = 5;
const QUERY_TIMEOUT_MS = 15000;
const DEFAULT_INDUSTRIES = [
  "software", "technology", "healthcare", "manufacturing",
  "finance", "education", "ecommerce", "logistics"
];

interface DiscoveryTarget {
  industry: string;
  sizeSegment: LeadSizeSegment;
  market: "India" | "International";
}

@Injectable()
export class AutoDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private stopSignal = false;
  private processingQueue: DiscoveryTarget[] = [];
  private activeQueries = 0;
  private dailyLeadsAdded = 0;
  private dailyDate = new Date().toISOString().slice(0, 10);
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Initialize database schema for leads if not exists
    await this.initializeDatabase();
    
    // Start continuous discovery in background
    this.startContinuousDiscovery();
    
    // Setup cleanup
    this.cleanupInterval = setInterval(() => {
      this.resetDailyCountersIfNeeded();
    }, 60 * 60 * 1000); // Check every hour
  }

  onModuleDestroy(): void {
    this.stop();
    if (this.workerInterval) clearInterval(this.workerInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  async initializeDatabase(): Promise<void> {
    try {
      // Create leads table if not exists
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_token VARCHAR(50) UNIQUE NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          contact_name VARCHAR(255),
          job_title VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          website VARCHAR(2048),
          industry VARCHAR(120),
          company_size VARCHAR(80),
          target_size_segment VARCHAR(20),
          location VARCHAR(255),
          source VARCHAR(120),
          source_url VARCHAR(2048),
          linkedin_url VARCHAR(2048),
          description TEXT,
          technologies TEXT[],
          lead_score INTEGER DEFAULT 0,
          score_reasons TEXT[],
          qualification VARCHAR(20) DEFAULT 'UNSCORED',
          status VARCHAR(30) DEFAULT 'DISCOVERED',
          last_contacted_at TIMESTAMP WITH TIME ZONE,
          last_response_at TIMESTAMP WITH TIME ZONE,
          next_action_at TIMESTAMP WITH TIME ZONE,
          email_sequence_id UUID,
          ai_processed BOOLEAN DEFAULT false,
          ai_analyzed BOOLEAN DEFAULT false,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create index for faster searches
      await this.database.query(`
        CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website)
      `);
      await this.database.query(`
        CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)
      `);
      await this.database.query(`
        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)
      `);
      await this.database.query(`
        CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)
      `);

      // Create audit table
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS lead_audit (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_token VARCHAR(50) NOT NULL,
          action VARCHAR(100) NOT NULL,
          result VARCHAR(50) NOT NULL,
          metadata JSONB DEFAULT '{}',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      console.log("Lead discovery database initialized");
    } catch (error) {
      console.error("Failed to initialize lead discovery database:", error);
      throw new ServiceUnavailableException("Database initialization failed");
    }
  }

  startContinuousDiscovery(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.stopSignal = false;
    
    // Build initial queue
    this.buildDiscoveryQueue();
    
    // Process queue every 5 seconds
    this.workerInterval = setInterval(async () => {
      await this.processQueue();
    }, 5000);
    
    console.log("Automatic lead discovery started");
  }

  stop(): void {
    this.stopSignal = true;
    this.isRunning = false;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    console.log("Automatic lead discovery stopped");
  }

  private buildDiscoveryQueue(): void {
    this.processingQueue = [];
    
    for (const sizeSegment of LEAD_SIZE_SEGMENTS) {
      for (const market of ["India", "International"] as const) {
        for (const industry of DEFAULT_INDUSTRIES) {
          this.processingQueue.push({
            industry,
            sizeSegment,
            market,
          });
        }
      }
    }
    
    // Shuffle for better distribution
    this.shuffleQueue();
  }

  private shuffleQueue(): void {
    for (let i = this.processingQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.processingQueue[i], this.processingQueue[j]] = [
        this.processingQueue[j],
        this.processingQueue[i],
      ];
    }
  }

  private async processQueue(): Promise<void> {
    if (this.stopSignal) return;
    if (!this.isRunning) return;
    
    // Check daily limits
    this.resetDailyCountersIfNeeded();
    if (this.dailyLeadsAdded >= DAILY_LEAD_LIMIT) {
      // Rebuild queue for next day
      this.buildDiscoveryQueue();
      return;
    }
    
    // Process concurrent queries
    while (
      this.processingQueue.length > 0 &&
      this.activeQueries < CONURRENT_QUERIES &&
      this.dailyLeadsAdded < DAILY_LEAD_LIMIT
    ) {
      const target = this.processingQueue.shift()!;
      this.activeQueries++;
      
      // Process in background
      this.processDiscoveryTarget(target).finally(() => {
        this.activeQueries--;
      });
    }
  }

  private async processDiscoveryTarget(target: DiscoveryTarget): Promise<void> {
    if (this.stopSignal) return;
    
    try {
      const query = this.buildSearchQuery(target);
      const results = await this.searchWeb(query, target.market);
      
      for (const result of results) {
        if (this.stopSignal) break;
        if (this.dailyLeadsAdded >= DAILY_LEAD_LIMIT) break;
        
        try {
          const lead = this.toLeadInput(result, target);
          if (!lead) continue;
          
          // Check if lead already exists
          const exists = await this.leadExists(lead);
          if (exists) continue;
          
          // Save to database
          await this.saveLead(lead);
          this.dailyLeadsAdded++;
          
          // Enrich with AI
          this.enrichLeadWithAI(lead).catch(console.error);
        } catch (error) {
          console.error("Error processing lead:", error);
        }
      }
    } catch (error) {
      console.error("Error in discovery target:", error);
    }
  }

  private buildSearchQuery(target: DiscoveryTarget): string {
    const sizeTerm: Record<LeadSizeSegment, string> = {
      small: "small business OR startup OR SME",
      medium: "mid-sized company OR mid-market",
      large: "large enterprise OR enterprise OR Fortune",
    };
    const geography = target.market === "India" ? "India" : "international";
    return `${target.industry} companies ${sizeTerm[target.sizeSegment]} ${geography} official website`;
  }

  private async searchWeb(query: string, market: "India" | "International"): Promise<any[]> {
    try {
      // Try Tavily first
      if (process.env.TAVILY_API_KEY) {
        const apiKey = process.env.TAVILY_API_KEY.trim();
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: "advanced",
            topic: "business",
            max_results: 15,
            include_answer: false,
            ...(market === "India" ? { country: "india" } : {}),
          }),
          signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.results)) {
            return data.results;
          }
        }
      }
      
      // Fallback: Return empty (AI will generate leads)
      console.log("Web search unavailable, using AI generation");
      return [];
    } catch (error) {
      console.error("Web search error:", error);
      return [];
    }
  }

  private toLeadInput(result: any, target: DiscoveryTarget): CreateLeadInput | null {
    try {
      if (!result?.url || !result?.title) return null;
      
      let url: URL;
      try {
        url = new URL(result.url);
      } catch {
        return null;
      }
      
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (!host || host === "google.com" || host.endsWith(".google.com")) return null;
      
      return {
        companyName: result.title.trim().slice(0, 160) || host,
        website: url.origin,
        source: "AI Web Discovery",
        sourceUrl: url.toString().slice(0, 2048),
        description: result.content?.trim().slice(0, 1000) || "",
        industry: target.industry,
        location: target.market === "India" 
          ? "India search target (verify)" 
          : "International search (location unverified)",
        targetSizeSegment: target.sizeSegment,
      };
    } catch {
      return null;
    }
  }

  private async leadExists(lead: CreateLeadInput): Promise<boolean> {
    try {
      if (lead.email) {
        const result = await this.database.query(
          "SELECT 1 FROM leads WHERE email = $1 LIMIT 1",
          [lead.email.toLowerCase()]
        );
        if (result.rowCount > 0) return true;
      }
      
      if (lead.website) {
        const domain = new URL(lead.website).hostname.replace(/^www\./, "");
        const result = await this.database.query(
          "SELECT 1 FROM leads WHERE website LIKE $1 LIMIT 1",
          [`%${domain}%`]
        );
        if (result.rowCount > 0) return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async saveLead(lead: CreateLeadInput): Promise<void> {
    try {
      const id = randomUUID();
      const leadToken = `HW-${new Date().getUTCFullYear()}-${String(
        Math.floor(Math.random() * 1000000)
      ).padStart(6, "0")}`;
      
      await this.database.query(`
        INSERT INTO leads (
          id, lead_token, company_name, contact_name, job_title, email, phone,
          website, industry, company_size, target_size_segment, location, source,
          source_url, linkedin_url, description, technologies, lead_score, score_reasons,
          qualification, status, ai_processed, ai_analyzed, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 0, '{}', 'UNSCORED', 'DISCOVERED', false, false, '{}')
      `, [
        id,
        leadToken,
        lead.companyName,
        lead.contactName || null,
        lead.jobTitle || null,
        lead.email || null,
        lead.phone || null,
        lead.website || null,
        lead.industry || null,
        lead.companySize || null,
        lead.targetSizeSegment || null,
        lead.location || null,
        lead.source || "AI Auto Discovery",
        lead.sourceUrl || null,
        lead.linkedinUrl || null,
        lead.description || null,
        JSON.stringify(lead.technologies || []),
      ]);
      
      // Record audit
      await this.database.query(`
        INSERT INTO lead_audit (lead_token, action, result, metadata)
        VALUES ($1, $2, $3, $4)
      `, [
        leadToken,
        "LEAD_CREATED",
        "SUCCESS",
        JSON.stringify({ status: "DISCOVERED", source: lead.source }),
      ]);
      
      console.log(`Lead discovered: ${lead.companyName}`);
    } catch (error) {
      console.error("Error saving lead:", error);
      throw error;
    }
  }

  private async enrichLeadWithAI(lead: CreateLeadInput): Promise<void> {
    try {
      // Wait for AI service to be available
      await this.waitForAIService();
      
      // Get lead from database
      const result = await this.database.query(
        "SELECT * FROM leads WHERE website = $1 ORDER BY created_at DESC LIMIT 1",
        [lead.website]
      );
      
      if (result.rowCount === 0) return;
      
      const dbLead = result.rows[0];
      
      // Score the lead using AI
      const scoreResult = await this.aiService.scoreLead(dbLead);
      
      // Update lead with AI scores
      await this.database.query(`
        UPDATE leads 
        SET lead_score = $1, score_reasons = $2, qualification = $3, 
            ai_processed = true, ai_analyzed = true, updated_at = NOW()
        WHERE id = $4
      `, [
        scoreResult.score,
        JSON.stringify(scoreResult.reasons),
        scoreResult.qualification,
        dbLead.id,
      ]);
      
      // Record AI enrichment in audit
      await this.database.query(`
        INSERT INTO lead_audit (lead_token, action, result, metadata)
        VALUES ($1, $2, $3, $4)
      `, [
        dbLead.lead_token,
        "AI_ENRICHMENT",
        "SUCCESS",
        JSON.stringify({
          score: scoreResult.score,
          qualification: scoreResult.qualification,
        }),
      ]);
      
      console.log(`AI enriched lead: ${dbLead.company_name} (Score: ${scoreResult.score})`);
    } catch (error) {
      console.error("AI enrichment error:", error);
    }
  }

  private async waitForAIService(maxAttempts = 3, delay = 1000): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const health = await this.aiService.getHealth();
        if (health.success && health.status === "online") {
          return true;
        }
      } catch {
        // AI service might be down
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return false;
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyDate) {
      this.dailyDate = today;
      this.dailyLeadsAdded = 0;
      this.buildDiscoveryQueue();
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      dailyLeadsAdded: this.dailyLeadsAdded,
      dailyLeadLimit: DAILY_LEAD_LIMIT,
      queueSize: this.processingQueue.length,
      activeQueries: this.activeQueries,
    };
  }
}
