export const leadStatuses = [
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

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadSizeSegment = "small" | "medium" | "large";

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

export interface DiscoveryTargets {
  industries: string[];
  sizeSegments: LeadSizeSegment[];
}

export interface LeadDiscoveryStatus {
  provider: string;
  providerConfigured: boolean;
  scheduleEnabled: boolean;
  schedulePersistence: string;
  dailyLeadLimit: number;
  dailyLeadsAdded: number;
  dailyQueryLimit: number;
  dailyQueriesUsed: number;
  nextRunAt: string | null;
  targets: DiscoveryTargets;
  lastRun: {
    status: "idle" | "running" | "completed" | "failed" | "stopped";
    startedAt: string | null;
    completedAt: string | null;
    added: number;
    skipped: number;
    error: string | null;
  };
}

export interface LeadDiscoveryResult {
  success: boolean;
  scheduled: boolean;
  status: LeadDiscoveryStatus["lastRun"]["status"];
  added: number;
  skipped: number;
  error: string | null;
  dailyLeadsAdded: number;
  dailyLeadLimit: number;
  dailyQueriesUsed: number;
  dailyQueryLimit: number;
}

export interface CrmStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  contacted: number;
  replied: number;
  interested: number;
  meetingRequested: number;
  customers: number;
  notInterested: number;
  unsubscribed: number;
  suppressed: number;
  byStatus: Record<LeadStatus, number>;
}

export interface EmailIntegrationStatus {
  inboundConfigured: boolean;
  outboundConfigured: boolean;
}