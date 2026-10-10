import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

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

  create(input: CreateLeadInput): Lead {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Lead payload must be an object.");
    }
    const companyName = this.requiredText(input.companyName, "companyName", 160);
    const email = this.optionalText(input.email, "email", 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("A valid business email address is required.");
    }
    const website = this.optionalText(input.website, "website", 2048);
    const duplicate = Array.from(this.leads.values()).find((lead) => {
      if (email && lead.email.toLowerCase() === email) return true;
      return !email && !lead.email &&
        this.normalizeCompany(lead.companyName) === this.normalizeCompany(companyName) &&
        this.normalizeDomain(lead.website) === this.normalizeDomain(website);
    });
    if (duplicate) {
      throw new ConflictException({
        message: "A duplicate lead already exists.",
        leadToken: duplicate.leadToken,
      });
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
      source: this.optionalText(input.source, "source", 120),
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
    return lead;
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
    return lead;
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
    return lead;
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
    this.auditEvents.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      leadToken: lead.leadToken,
      action,
      result,
      metadata,
    });
    if (this.auditEvents.length > 5000) this.auditEvents.shift();
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
