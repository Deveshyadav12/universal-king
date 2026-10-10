import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  KING_AI_LAYERS,
  KING_LANGUAGES,
  KING_SECURITY_CONTROLS,
} from "./king.catalog";
import { AiService } from "../ai/ai.service";
import { ProjectsService } from "../projects/projects.service";
import { BillingService } from "../billing/billing.service";

export type SoftwareRequestStatus = "pending" | "approved" | "rejected";
export type SoftwareGenerationStatus = "waiting" | "generating" | "ready" | "failed";
export type SoftwareRequestRefundStatus = "processing" | "pending" | "refunded" | "failed";

export interface CompanySoftwareRequest {
  id: string;
  companyName: string;
  productName: string;
  languages: string[];
  stack: string;
  purpose: string;
  requestedBy: string;
  requestedById: string;
  paymentIntentId?: string;
  refundStatus?: SoftwareRequestRefundStatus;
  status: SoftwareRequestStatus;
  generationStatus: SoftwareGenerationStatus;
  projectId: string | null;
  generationError: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

export type PublicCompanySoftwareRequest = Omit<
  CompanySoftwareRequest,
  "requestedById" | "paymentIntentId"
>;

export interface CreateSoftwareRequestInput {
  companyName: string;
  productName: string;
  languages?: string[];
  stack?: string;
  purpose: string;
}

const MAX_REQUESTS = 200;
const MAX_NAME = 80;
const MAX_PURPOSE = 500;

@Injectable()
export class KingService {
  private readonly requests = new Map<string, CompanySoftwareRequest>();
  private readonly requestStorePath = resolve(
    process.env.HEXAWAVE_KING_REQUEST_STORE ?? "data/king-requests.json",
  );

  constructor(
    private readonly aiService: AiService,
    private readonly projectsService: ProjectsService,
    private readonly billingService: BillingService,
  ) {
    this.loadRequests();
  }

  catalog() {
    return {
      name: "Universal King",
      mission:
        "Companies ship software through HexaWave only after operator approval, using a mixed-language IDE and defensive security controls.",
      languages: [...KING_LANGUAGES],
      securityControls: KING_SECURITY_CONTROLS.map((control) => ({ ...control })),
      aiLayers: KING_AI_LAYERS.map((layer) => ({ ...layer })),
      excluded:
        "Offensive intrusion, exploit kits, and unauthorised access tooling are not part of Universal King.",
    };
  }

  listRequests(requestedById?: string): PublicCompanySoftwareRequest[] {
    return Array.from(this.requests.values())
      .filter((request) => requestedById === undefined || request.requestedById === requestedById)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((request) => this.publicRequest(request, requestedById === undefined));
  }

  createRequest(
    input: CreateSoftwareRequestInput,
    requester: { id: string; email: string },
    paymentIntentId?: string,
  ): PublicCompanySoftwareRequest {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Software request payload must be an object.");
    }
    if (paymentIntentId) {
      const existing = Array.from(this.requests.values()).find(
        (request) => request.paymentIntentId === paymentIntentId,
      );
      if (existing) return this.publicRequest(existing);
    }
    if (this.requests.size >= MAX_REQUESTS) {
      throw new ConflictException("The software request queue is full.");
    }
    const companyName = this.requiredText(input.companyName, "companyName", MAX_NAME);
    const productName = this.requiredText(input.productName, "productName", MAX_NAME);
    const purpose = this.requiredText(input.purpose, "purpose", MAX_PURPOSE);
    const languages = this.normaliseLanguages(input.languages);
    const stack = this.optionalText(input.stack, "stack", MAX_NAME) ?? languages.join(" + ");

    const timestamp = new Date().toISOString();
    const request: CompanySoftwareRequest = {
      id: randomUUID(),
      companyName,
      productName,
      languages,
      stack,
      purpose,
      requestedBy: requester.email,
      requestedById: requester.id,
      ...(paymentIntentId ? { paymentIntentId } : {}),
      status: "pending",
      generationStatus: "waiting",
      projectId: null,
      generationError: null,
      createdAt: timestamp,
      decidedAt: null,
      decidedBy: null,
      decisionNote: null,
    };
    this.requests.set(request.id, request);
    this.persistRequests();
    return this.publicRequest(request);
  }

  createPaidRequest(
    input: CreateSoftwareRequestInput,
    requester: { id: string; email: string },
    paymentIntentId: string,
  ): PublicCompanySoftwareRequest {
    if (!paymentIntentId || paymentIntentId.length > 100) {
      throw new BadRequestException("A valid verified payment reference is required.");
    }
    return this.createRequest(input, requester, paymentIntentId);
  }

  async decide(
    id: string,
    status: Exclude<SoftwareRequestStatus, "pending">,
    decider: { id: string; email: string },
    decisionNote?: string,
  ): Promise<PublicCompanySoftwareRequest> {
    const request = this.requests.get(id);
    if (!request) throw new NotFoundException(`Software request not found: ${id}`);
    if (request.status !== "pending") {
      throw new ConflictException("This request already has a decision.");
    }
    const refundStatus =
      status === "rejected" && request.paymentIntentId
        ? await this.billingService.refundSoftwareRequestPayment(request.paymentIntentId)
        : undefined;
    const updated: CompanySoftwareRequest = {
      ...request,
      status,
      ...(refundStatus ? { refundStatus } : {}),
      decidedAt: new Date().toISOString(),
      decidedBy: decider.email,
      decisionNote: this.optionalText(decisionNote, "decisionNote", MAX_PURPOSE),
    };
    this.requests.set(id, updated);
    this.persistRequests();
    if (status === "approved") {
      return this.publicRequest(await this.generateApprovedRequest(updated), true);
    }
    return this.publicRequest(updated, true);
  }

  updateRefundStatusByPayment(
    paymentIntentId: string,
    refundStatus: SoftwareRequestRefundStatus,
  ): void {
    const request = Array.from(this.requests.values()).find(
      (item) => item.paymentIntentId === paymentIntentId,
    );
    if (!request) return;
    this.requests.set(request.id, { ...request, refundStatus });
    this.persistRequests();
  }

  async retryGeneration(id: string): Promise<PublicCompanySoftwareRequest> {
    const request = this.requests.get(id);
    if (!request) throw new NotFoundException(`Software request not found: ${id}`);
    if (request.status !== "approved" || request.generationStatus !== "failed") {
      throw new ConflictException("Only approved requests with failed generation can be retried.");
    }
    return this.publicRequest(await this.generateApprovedRequest(request), true);
  }

  private publicRequest(
    request: CompanySoftwareRequest,
    includeGenerationError = false,
  ): PublicCompanySoftwareRequest {
    const {
      requestedById: _requestedById,
      paymentIntentId: _paymentIntentId,
      ...publicRequest
    } = request;
    void _requestedById;
    void _paymentIntentId;
    return {
      ...publicRequest,
      generationError:
        includeGenerationError || !request.generationError
          ? request.generationError
          : "Generation failed; an administrator can retry it.",
    };
  }

  private async generateApprovedRequest(
    request: CompanySoftwareRequest,
  ): Promise<CompanySoftwareRequest> {
    let updated: CompanySoftwareRequest = {
      ...request,
      generationStatus: "generating",
      generationError: null,
    };
    this.requests.set(request.id, updated);
    this.persistRequests();

    try {
      let projectId = updated.projectId;
      const projectData = {
        name: updated.productName,
        type: "Company software",
        stack: updated.stack,
        description: updated.purpose,
      };

      if (!projectId) {
        const requestedProjectId = this.projectsService.createId();
        const workspace = await this.billingService.executeAiAction(request.requestedById, () =>
          this.aiService.createWorkspace(requestedProjectId, projectData),
        );
        const workspaceId = workspace?.project?.id;
        if (typeof workspaceId !== "string" || workspaceId !== requestedProjectId) {
          throw new InternalServerErrorException("AI returned an unexpected workspace identifier.");
        }
        projectId = workspaceId;
        this.projectsService.createProject(projectData, projectId, updated.requestedById);
        updated = { ...updated, projectId };
        this.requests.set(updated.id, updated);
        this.persistRequests();
      }

      const generation = await this.billingService.executeAiAction(
        updated.requestedById,
        () =>
          this.aiService.generate({
            projectId,
            projectName: updated.productName,
            projectType: "Company software",
            stack: updated.stack,
            generationMode: "full",
            prompt: [
              `Build ${updated.productName} for ${updated.companyName}.`,
              `Purpose: ${updated.purpose}`,
              `Use the requested stack: ${updated.stack}.`,
              "Create a maintainable, tested implementation and keep language boundaries explicit.",
              "Apply secure defaults, least privilege, input validation, and dependency-safe patterns.",
              "Do not create offensive intrusion or unauthorized-access functionality.",
              "Generate files only; do not deploy or run the project. Deployment requires separate operator approval.",
            ].join("\n"),
          }),
      );
      if (generation.success === false || generation.status === "failed") {
        throw new InternalServerErrorException("AI code generation did not complete successfully.");
      }

      updated = { ...updated, generationStatus: "ready", generationError: null };
      this.requests.set(updated.id, updated);
      this.persistRequests();
      return updated;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown AI generation failure.";
      updated = {
        ...updated,
        generationStatus: "failed",
        generationError: detail,
      };
      this.requests.set(updated.id, updated);
      this.persistRequests();
      throw error;
    }
  }

  private loadRequests(): void {
    if (!existsSync(this.requestStorePath)) return;
    const parsed: unknown = JSON.parse(readFileSync(this.requestStorePath, "utf8"));
    if (!Array.isArray(parsed) || parsed.some((request) => !this.isStoredRequest(request))) {
      throw new Error("Universal King request store has an invalid format.");
    }
    for (const request of parsed) this.requests.set(request.id, request);
  }

  private persistRequests(): void {
    mkdirSync(dirname(this.requestStorePath), { recursive: true });
    const temporaryPath = `${this.requestStorePath}.${randomUUID()}.tmp`;
    writeFileSync(
      temporaryPath,
      JSON.stringify(Array.from(this.requests.values()), null, 2),
      { encoding: "utf8", mode: 0o600 },
    );
    renameSync(temporaryPath, this.requestStorePath);
  }

  private isStoredRequest(value: unknown): value is CompanySoftwareRequest {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const request = value as Record<string, unknown>;
    return (
      typeof request.id === "string" &&
      typeof request.companyName === "string" &&
      typeof request.productName === "string" &&
      Array.isArray(request.languages) &&
      request.languages.every((language) => typeof language === "string") &&
      typeof request.stack === "string" &&
      typeof request.purpose === "string" &&
      typeof request.requestedBy === "string" &&
      typeof request.requestedById === "string" &&
      (request.paymentIntentId === undefined || typeof request.paymentIntentId === "string") &&
      (request.refundStatus === undefined ||
        ["processing", "pending", "refunded", "failed"].includes(String(request.refundStatus))) &&
      ["pending", "approved", "rejected"].includes(String(request.status)) &&
      ["waiting", "generating", "ready", "failed"].includes(String(request.generationStatus)) &&
      (request.projectId === null || typeof request.projectId === "string") &&
      (request.generationError === null || typeof request.generationError === "string") &&
      typeof request.createdAt === "string" &&
      (request.decidedAt === null || typeof request.decidedAt === "string") &&
      (request.decidedBy === null || typeof request.decidedBy === "string") &&
      (request.decisionNote === null || typeof request.decisionNote === "string")
    );
  }

  private requiredText(value: unknown, field: string, max: number): string {
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text.`);
    const text = value.trim();
    if (!text) throw new BadRequestException(`${field} is required.`);
    if (text.length > max) throw new BadRequestException(`${field} exceeds ${max} characters.`);
    return text;
  }

  private optionalText(value: unknown, field: string, max: number): string | null {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredText(value, field, max);
  }

  private normaliseLanguages(value: unknown): string[] {
    if (value === undefined || value === null) return ["TypeScript", "Python"];
    if (!Array.isArray(value)) {
      throw new BadRequestException("languages must be a list of language names.");
    }
    const allowed = new Set<string>(KING_LANGUAGES);
    const unique = Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
    const unknown = unique.filter((language) => !allowed.has(language));
    if (unknown.length) {
      throw new BadRequestException(`Unsupported languages: ${unknown.join(", ")}.`);
    }
    if (unique.length === 0) return ["TypeScript", "Python"];
    return unique;
  }
}
