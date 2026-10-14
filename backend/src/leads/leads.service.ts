import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database/database.service";

// Note: DatabaseService is injected but the original in-memory implementation
// is kept for backward compatibility. The new auto-discovery.service.ts
// provides the database-backed lead discovery.

// For the purpose of this implementation, we'll maintain the in-memory service
// as the existing project uses it. The database-backed lead storage is handled
// by the auto-discovery.service.ts which already uses the database.
//
// This service is kept to maintain backward compatibility with existing endpoints.

// =============================================================================
// Lead Types and Constants
// =============================================================================

export const LEAD_STATUSES = [
  "DISCOVERED",
  "RESEARCHING",
  "QUALIFIED",
  "READY_TO_CONTACT",
  "CONTACTED",
  "FOLLOW_UP",
  "REPLIED",
  "INTERESTED",
  "MEETING_REQUESTED",
  "CUSTOMER",
  "NOT_INTERESTED",
  "UNSUBSCRIBED",
  "BOUNCED",
  "INVALID",
  "SUPPRESSED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SIZE_SEGMENTS = ["small", "medium", "large"] as const;
export type LeadSizeSegment = (typeof LEAD_SIZE_SEGMENTS)[number];

export interface Lead {
  id: string;
  leadToken: string;
  companyName: string;
  contactName: string;
  jobTitle: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  companySize: string;
  targetSizeSegment: LeadSizeSegment | "";
  location: string;
  source: string;
  sourceUrl: string;
  linkedinUrl: string;
  description: string;
  technologies: string[];
  leadScore: number;
  scoreReasons: string[];
  qualification: string;
  status: LeadStatus;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  nextActionAt: string | null;
  emailSequenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  companyName: string;
  contactName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  targetSizeSegment?: LeadSizeSegment | "";
  location?: string;
  source?: string;
  sourceUrl?: string;
  linkedinUrl?: string;
  description?: string;
  technologies?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  leadToken: string;
  action: string;
  result: string;
  metadata: Record<string, string | number | boolean>;
}

// =============================================================================
// Lead Service Implementation
// =============================================================================

const SUPPRESSED_STATUSES = new Set<LeadStatus>([
  "UNSUBSCRIBED",
  "BOUNCED",
  "INVALID",
  "SUPPRESSED",
]);

const STATUS_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  DISCOVERED: ["RESEARCHING", "QUALIFIED", "NOT_INTERESTED", "SUPPRESSED", "INVALID"],
  RESEARCHING: ["QUALIFIED", "NOT_INTERESTED", "SUPPRESSED", "INVALID"],
  QUALIFIED: ["READY_TO_CONTACT", "NOT_INTERESTED", "SUPPRESSED", "INVALID"],
  READY_TO_CONTACT: ["CONTACTED", "NOT_INTERESTED", "SUPPRESSED", "INVALID"],
  CONTACTED: ["FOLLOW_UP", "REPLIED", "INTERESTED", "MEETING_REQUESTED", "CUSTOMER", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED", "SUPPRESSED", "INVALID"],
  FOLLOW_UP: ["REPLIED", "INTERESTED", "MEETING_REQUESTED", "CUSTOMER", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED", "SUPPRESSED", "INVALID"],
  REPLIED: ["INTERESTED", "MEETING_REQUESTED", "CUSTOMER", "NOT_INTERESTED", "UNSUBSCRIBED", "SUPPRESSED"],
  INTERESTED: ["MEETING_REQUESTED", "CUSTOMER", "NOT_INTERESTED", "UNSUBSCRIBED", "SUPPRESSED"],
  MEETING_REQUESTED: ["CUSTOMER", "NOT_INTERESTED", "UNSUBSCRIBED", "SUPPRESSED"],
  CUSTOMER: ["SUPPRESSED"],
  NOT_INTERESTED: ["SUPPRESSED"],
  UNSUBSCRIBED: [],
  BOUNCED: [],
  INVALID: [],
  SUPPRESSED: [],
};

@Injectable()
export class LeadsService {
  private readonly leads = new Map<string, Lead>();
  private readonly auditEvents: AuditEvent[] = [];
  private nextToken = 1;

  constructor(private readonly database: DatabaseService) {
    // Initialize from database if available
    this.initializeFromDatabase().catch(console.error);
  }

  private async initializeFromDatabase(): Promise<void> {
    try {
      // Load existing leads from database
      const result = await this.database.query(
        `SELECT id, lead_token AS "leadToken", company_name AS "companyName",
                contact_name AS "contactName", job_title AS "jobTitle", email, phone,
                website, industry, company_size AS "companySize",
                target_size_segment AS "targetSizeSegment", location, source, source_url AS "sourceUrl",
                linkedin_url AS "linkedinUrl", description, technologies,
                lead_score AS "leadScore", score_reasons AS "scoreReasons", qualification,
                status, last_contacted_at AS "lastContactedAt",
                last_response_at AS "lastResponseAt", next_action_at AS "nextActionAt",
                email_sequence_id AS "emailSequenceId", created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM leads ORDER BY created_at DESC`,
      );

      for (const row of result.rows) {
        const lead: Lead = {
          id: row.id,
          leadToken: row.leadToken,
          companyName: row.companyName,
          contactName: row.contactName || "",
          jobTitle: row.jobTitle || "",
          email: row.email || "",
          phone: row.phone || "",
          website: row.website || "",
          industry: row.industry || "",
          companySize: row.companySize || "",
          targetSizeSegment: (row.targetSizeSegment as LeadSizeSegment | "") || "",
          location: row.location || "",
          source: row.source,
          sourceUrl: row.sourceUrl || "",
          linkedinUrl: row.linkedinUrl || "",
          description: row.description || "",
          technologies: Array.isArray(row.technologies) 
            ? row.technologies 
            : (typeof row.technologies === 'string' 
              ? JSON.parse(row.technologies || '[]') 
              : []),
          leadScore: row.leadScore || 0,
          scoreReasons: Array.isArray(row.scoreReasons) 
            ? row.scoreReasons 
            : (typeof row.scoreReasons === 'string' 
              ? JSON.parse(row.scoreReasons || '[]') 
              : []),
          qualification: row.qualification || "UNSCORED",
          status: row.status as LeadStatus,
          lastContactedAt: row.lastContactedAt,
          lastResponseAt: row.lastResponseAt,
          nextActionAt: row.nextActionAt,
          emailSequenceId: row.emailSequenceId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };

        this.leads.set(lead.id, lead);
        if (lead.leadToken) {
          // Also index by token for backward compatibility
        }
      }

      // Update nextToken
      const maxToken = await this.database.query<{ leadToken: string }>(
        'SELECT lead_token FROM leads ORDER BY lead_token DESC LIMIT 1',
      );
      if (maxToken.rows[0]) {
        const token = maxToken.rows[0].leadToken;
        const year = new Date().getUTCFullYear();
        const num = parseInt(token.replace(`HW-${year}-`, ''), 10);
        if (!isNaN(num)) {
          this.nextToken = Math.max(this.nextToken, num + 1);
        }
      }

      console.log(`Loaded ${result.rows.length} leads from database`);
    } catch (error) {
      console.error('Failed to initialize leads from database:', error);
    }
  }

  list(status?: LeadStatus): Lead[] {
    return Array.from(this.leads.values())
      .filter((lead) => !status || lead.status === status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  get(id: string): Lead {
    const lead = this.leads.get(id) ??
      Array.from(this.leads.values()).find((candidate) => candidate.leadToken === id);
    if (!lead) throw new NotFoundException(`Lead not found: ${id}`);
    return lead;
  }

  async create(input: CreateLeadInput): Promise<Lead> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Lead payload must be an object.");
    }
    const companyName = this.requiredText(input.companyName, "companyName", 160);
    const email = this.optionalText(input.email, "email", 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("A valid business email address is required.");
    }
    const website = this.optionalText(input.website, "website", 2048);
    
    // Check for duplicates in memory and database
    if (await this.hasDuplicateInMemory(input, email, companyName, website)) {
      const existing = Array.from(this.leads.values()).find((lead) => {
        if (email && lead.email.toLowerCase() === email) return true;
        return !email && !lead.email &&
          this.normalizeCompany(lead.companyName) === this.normalizeCompany(companyName) &&
          this.normalizeDomain(lead.website) === this.normalizeDomain(website);
      });
      if (existing) {
        throw new ConflictException({
          message: "A duplicate lead already exists.",
          leadToken: existing.leadToken,
        });
      }
    }

    const timestamp = new Date().toISOString();
    const id = randomUUID();
    const lead: Lead = {
      id,
      leadToken: `HW-${new Date().getUTCFullYear()}-${String(this.nextToken++).padStart(6, "0")}`,
      companyName,
      contactName: this.optionalText(input.contactName, "contactName", 160),
      jobTitle: this.optionalText(input.jobTitle, "jobTitle", 160),
      email,
      phone: this.optionalText(input.phone, "phone", 40),
      website,
      industry: this.optionalText(input.industry, "industry", 120),
      companySize: this.optionalText(input.companySize, "companySize", 80),
      targetSizeSegment: this.optionalSizeSegment(input.targetSizeSegment),
      location: this.optionalText(input.location, "location", 160),
      source: this.optionalText(input.source, "source", 120) || "manual",
      sourceUrl: this.optionalText(input.sourceUrl, "sourceUrl", 2048),
      linkedinUrl: this.optionalText(input.linkedinUrl, "linkedinUrl", 2048),
      description: this.optionalText(input.description, "description", 4000),
      technologies: this.optionalStringArray(input.technologies, "technologies"),
      leadScore: 0,
      scoreReasons: [],
      qualification: "UNSCORED",
      status: "DISCOVERED",
      lastContactedAt: null,
      lastResponseAt: null,
      nextActionAt: null,
      emailSequenceId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.leads.set(id, lead);
    this.record(lead, "LEAD_CREATED", "SUCCESS", { status: lead.status });

    // Persist to database
    this.persistToDatabase(lead).catch(console.error);

    return lead;
  }

  private async hasDuplicateInMemory(
    input: CreateLeadInput,
    email: string,
    companyName: string,
    website: string,
  ): Promise<boolean> {
    // Check in memory first
    const inMemoryDuplicate = Array.from(this.leads.values()).find((lead) => {
      if (email && lead.email.toLowerCase() === email) return true;
      return !email && !lead.email &&
        this.normalizeCompany(lead.companyName) === this.normalizeCompany(companyName) &&
        this.normalizeDomain(lead.website) === this.normalizeDomain(website);
    });
    
    if (inMemoryDuplicate) {
      return true;
    }

    // Check in database
    try {
      if (email) {
        const result = await this.database.query(
          'SELECT 1 FROM leads WHERE email = $1 LIMIT 1',
          [email.toLowerCase()],
        );
        if (result.rowCount && result.rowCount > 0) return true;
      }
      
      if (website) {
        const domain = this.normalizeDomain(website);
        const result = await this.database.query(
          'SELECT 1 FROM leads WHERE normalize_domain(website) = $1 LIMIT 1',
          [domain],
        );
        if (result.rowCount && result.rowCount > 0) return true;
      }
      
      return false;
    } catch (error) {
      // If database check fails, rely on in-memory check
      return false;
    }
  }

  private async persistToDatabase(lead: Lead): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO leads (
          id, lead_token, company_name, contact_name, job_title, email, phone,
          website, industry, company_size, target_size_segment, location, source,
          source_url, linkedin_url, description, technologies, lead_score, score_reasons,
          qualification, status, last_contacted_at, last_response_at, next_action_at,
          email_sequence_id, ai_processed, ai_analyzed, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, false, false, '{}', $28, $29)
        ON CONFLICT (id) DO NOTHING`,
        [
          lead.id,
          lead.leadToken,
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
          lead.source,
          lead.sourceUrl || null,
          lead.linkedinUrl || null,
          lead.description || null,
          JSON.stringify(lead.technologies || []),
          lead.leadScore || 0,
          JSON.stringify(lead.scoreReasons || []),
          lead.qualification || 'UNSCORED',
          lead.status,
          lead.lastContactedAt,
          lead.lastResponseAt,
          lead.nextActionAt,
          lead.emailSequenceId,
          new Date(lead.createdAt),
          new Date(lead.updatedAt),
        ],
      );
    } catch (error) {
      console.error('Failed to persist lead to database:', error);
    }
  }

  update(id: string, changes: Partial<CreateLeadInput> & { status?: string }): Lead {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new BadRequestException("Lead update must be an object.");
    }
    const lead = structuredClone(this.get(id));
    if (SUPPRESSED_STATUSES.has(lead.status)) {
      throw new ConflictException("Suppressed leads cannot be modified or re-enabled.");
    }

    const allowedFields = new Set([
      "companyName", "contactName", "jobTitle", "email", "phone", "website",
      "industry", "companySize", "targetSizeSegment", "location", "source", "sourceUrl",
      "linkedinUrl", "description", "technologies", "status",
    ]);
    const unknownFields = Object.keys(changes).filter((field) => !allowedFields.has(field));
    if (unknownFields.length) {
      throw new BadRequestException(`Unsupported lead fields: ${unknownFields.join(", ")}`);
    }

    let suppressionAction: string | undefined;
    if (changes.status !== undefined) {
      if (!LEAD_STATUSES.includes(changes.status as LeadStatus)) {
        throw new BadRequestException("Unknown lead status.");
      }
      const nextStatus = changes.status as LeadStatus;
      if (!STATUS_TRANSITIONS[lead.status].includes(nextStatus)) {
        throw new ConflictException(`Invalid lead status transition: ${lead.status} → ${nextStatus}`);
      }
      lead.status = nextStatus;
      if (SUPPRESSED_STATUSES.has(nextStatus)) {
        suppressionAction = nextStatus === "UNSUBSCRIBED"
          ? "LEAD_UNSUBSCRIBED"
          : "LEAD_SUPPRESSED";
      }
    }

    const textFields = [
      "companyName", "contactName", "jobTitle", "email", "phone", "website",
      "industry", "companySize", "location", "source", "sourceUrl",
      "linkedinUrl", "description",
    ] as const;
    for (const field of textFields) {
      const value = changes[field];
      if (value === undefined) continue;
      const maxLength = field === "description" ? 4000 : field === "website" || field === "sourceUrl" || field === "linkedinUrl" ? 2048 : 254;
      const sanitized = this.optionalText(value, field, maxLength);
      if (field === "email" && sanitized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        throw new BadRequestException("A valid business email address is required.");
      }
      lead[field] = field === "email" ? sanitized.toLowerCase() : sanitized;
    }
    if (changes.targetSizeSegment !== undefined) {
      lead.targetSizeSegment = this.optionalSizeSegment(changes.targetSizeSegment);
    }
    if (changes.technologies !== undefined) {
      lead.technologies = this.optionalStringArray(changes.technologies, "technologies");
    }
    const duplicate = lead.email && Array.from(this.leads.values()).find(
      (candidate) => candidate.id !== lead.id && candidate.email.toLowerCase() === lead.email.toLowerCase(),
    );
    if (duplicate) throw new ConflictException({ message: "A lead with this email already exists.", leadToken: duplicate.leadToken });

    lead.updatedAt = new Date().toISOString();
    this.leads.set(lead.id, lead);
    if (suppressionAction) {
      this.record(lead, suppressionAction, "SUCCESS", { status: lead.status });
    }
    this.record(lead, "LEAD_UPDATED", "SUCCESS", { fields: Object.keys(changes).join(",") });

    // Persist to database
    this.updateInDatabase(lead).catch(console.error);

    return lead;
  }

  private async updateInDatabase(lead: Lead): Promise<void> {
    try {
      await this.database.query(
        `UPDATE leads SET
          company_name = $1, contact_name = $2, job_title = $3, email = $4, phone = $5,
          website = $6, industry = $7, company_size = $8, target_size_segment = $9,
          location = $10, source = $11, source_url = $12, linkedin_url = $13,
          description = $14, technologies = $15, lead_score = $16,
          score_reasons = $17, qualification = $18, status = $19,
          last_contacted_at = $20, last_response_at = $21, next_action_at = $22,
          email_sequence_id = $23, updated_at = NOW()
        WHERE id = $24`,
        [
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
          lead.source,
          lead.sourceUrl || null,
          lead.linkedinUrl || null,
          lead.description || null,
          JSON.stringify(lead.technologies || []),
          lead.leadScore || 0,
          JSON.stringify(lead.scoreReasons || []),
          lead.qualification || 'UNSCORED',
          lead.status,
          lead.lastContactedAt,
          lead.lastResponseAt,
          lead.nextActionAt,
          lead.emailSequenceId,
          lead.id,
        ],
      );
    } catch (error) {
      console.error('Failed to update lead in database:', error);
    }
  }

  suppress(id: string, reason: string): Lead {
    const lead = this.get(id);
    const auditReason = this.optionalText(reason, "reason", 120) || "manual";
    if (lead.status === "UNSUBSCRIBED" || lead.status === "BOUNCED" || lead.status === "INVALID") {
      return lead;
    }
    if (lead.status !== "SUPPRESSED") {
      lead.status = "SUPPRESSED";
      lead.nextActionAt = null;
      lead.updatedAt = new Date().toISOString();
      this.leads.set(lead.id, lead);
    }
    this.record(lead, "LEAD_SUPPRESSED", "SUCCESS", {
      reason: auditReason,
    });

    // Persist to database
    this.updateInDatabase(lead).catch(console.error);

    return lead;
  }

  updateScore(id: string, score: number, reasons: string[], qualification: string): Lead {
    const lead = structuredClone(this.get(id));
    if (SUPPRESSED_STATUSES.has(lead.status)) {
      throw new ConflictException("Suppressed leads cannot be scored or re-enabled.");
    }
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new BadRequestException("Lead score must be an integer from 0 to 100.");
    }
    const normalizedQualification = this.optionalText(qualification, "qualification", 80);
    if (!["HIGH_PRIORITY", "GOOD", "MEDIUM", "LOW"].includes(normalizedQualification)) {
      throw new BadRequestException("Unknown lead qualification.");
    }
    lead.leadScore = score;
    lead.scoreReasons = this.optionalStringArray(reasons, "scoreReasons");
    lead.qualification = normalizedQualification;
    lead.updatedAt = new Date().toISOString();
    this.leads.set(lead.id, lead);
    this.record(lead, "LEAD_SCORED", "SUCCESS", { score, qualification: lead.qualification });

    // Persist to database
    this.updateInDatabase(lead).catch(console.error);

    return lead;
  }

  recordOutboundEmailSent(id: string): Lead {
    const lead = this.get(id);
    const timestamp = new Date().toISOString();
    if (lead.status === "READY_TO_CONTACT") {
      lead.status = "CONTACTED";
    }
    lead.lastContactedAt = timestamp;
    lead.updatedAt = timestamp;
    this.leads.set(lead.id, lead);
    this.record(lead, "OUTBOUND_EMAIL_SENT", "SUCCESS", {
      status: lead.status,
    });

    // Persist to database
    this.updateInDatabase(lead).catch(console.error);

    return structuredClone(lead);
  }

  applyInboundEvent(
    email: string,
    eventType: "reply" | "unsubscribe" | "bounce",
  ): { leadToken: string; status: LeadStatus; applied: boolean } {
    const normalizedEmail = email.trim().toLowerCase();
    const lead = Array.from(this.leads.values()).find(
      (candidate) => candidate.email.toLowerCase() === normalizedEmail,
    );
    if (!lead) throw new NotFoundException("No lead matches the inbound sender.");

    const wasSuppressed = SUPPRESSED_STATUSES.has(lead.status);
    if (!wasSuppressed) {
      if (eventType === "unsubscribe") lead.status = "UNSUBSCRIBED";
      if (eventType === "bounce") lead.status = "BOUNCED";
      if (eventType === "reply") {
        lead.lastResponseAt = new Date().toISOString();
        if (lead.status === "CONTACTED" || lead.status === "FOLLOW_UP") {
          lead.status = "REPLIED";
        }
      }
      lead.updatedAt = new Date().toISOString();
    }
    this.record(
      lead,
      `INBOUND_${eventType.toUpperCase()}`,
      wasSuppressed ? "IGNORED_SUPPRESSED" : "SUCCESS",
      {},
    );

    // Persist to database
    this.updateInDatabase(lead).catch(console.error);

    return { leadToken: lead.leadToken, status: lead.status, applied: !wasSuppressed };
  }

  stats() {
    const counts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<LeadStatus, number>;
    for (const lead of this.leads.values()) counts[lead.status]++;
    return {
      totalLeads: this.leads.size,
      newLeads: counts.DISCOVERED,
      qualifiedLeads: counts.QUALIFIED + counts.READY_TO_CONTACT,
      contacted: counts.CONTACTED + counts.FOLLOW_UP,
      replied: counts.REPLIED,
      interested: counts.INTERESTED,
      meetingRequested: counts.MEETING_REQUESTED,
      customers: counts.CUSTOMER,
      notInterested: counts.NOT_INTERESTED,
      unsubscribed: counts.UNSUBSCRIBED,
      suppressed: counts.SUPPRESSED + counts.BOUNCED + counts.INVALID,
      byStatus: counts,
    };
  }

  audit(limit = 100): AuditEvent[] {
    return this.auditEvents.slice(-Math.max(1, Math.min(limit, 500))).reverse();
  }

  isSuppressed(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return Array.from(this.leads.values()).some(
      (lead) => lead.email.toLowerCase() === normalized && SUPPRESSED_STATUSES.has(lead.status),
    );
  }

  hasWebsiteDomain(website: string): boolean {
    const domain = this.normalizeDomain(website);
    if (!domain) return false;
    return Array.from(this.leads.values()).some(
      (lead) => this.normalizeDomain(lead.website) === domain,
    );
  }

  private record(
    lead: Lead,
    action: string,
    result: string,
    metadata: AuditEvent["metadata"],
  ): void {
    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      leadToken: lead.leadToken,
      action,
      result,
      metadata,
    };
    this.auditEvents.push(event);
    if (this.auditEvents.length > 5000) this.auditEvents.shift();

    // Persist to database
    this.persistAuditToDatabase(event).catch(console.error);
  }

  private async persistAuditToDatabase(event: AuditEvent): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO lead_audit (lead_token, action, result, metadata)
         VALUES ($1, $2, $3, $4)`,
        [event.leadToken, event.action, event.result, JSON.stringify(event.metadata)],
      );
    } catch (error) {
      console.error('Failed to persist audit event to database:', error);
    }
  }

  private requiredText(value: unknown, field: string, maxLength: number): string {
    const text = this.optionalText(value, field, maxLength);
    if (!text) throw new BadRequestException(`${field} is required.`);
    return text;
  }

  private optionalText(value: unknown, field: string, maxLength: number): string {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text.`);
    const text = value.trim();
    if (text.length > maxLength) throw new BadRequestException(`${field} exceeds ${maxLength} characters.`);
    return text;
  }

  private optionalStringArray(value: unknown, field: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new BadRequestException(`${field} must be an array of text values.`);
    }
    return value.slice(0, 50).map((item) => item.trim().slice(0, 120)).filter(Boolean);
  }

  private optionalSizeSegment(value: unknown): LeadSizeSegment | "" {
    if (value === undefined || value === null || value === "") return "";
    if (
      typeof value !== "string" ||
      !LEAD_SIZE_SEGMENTS.includes(value as LeadSizeSegment)
    ) {
      throw new BadRequestException("targetSizeSegment must be small, medium, or large.");
    }
    return value as LeadSizeSegment;
  }

  private normalizeCompany(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private normalizeDomain(value: string): string {
    try {
      return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  }
}
