import { ConflictException } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiService } from "../ai/ai.service";
import { BillingService } from "../billing/billing.service";
import { ProjectsService } from "../projects/projects.service";
import { KingService } from "./king.service";

describe("KingService", () => {
  let service: KingService;
  let aiService: AiService;
  let projectsService: ProjectsService;
  let temporaryDirectory: string;
  let generateSpy: ReturnType<typeof spyOnGenerate>;
  let workspaceSpy: ReturnType<typeof spyOnWorkspaceCreation>;

  function spyOnGenerate() {
    return vi.spyOn(aiService, "generate");
  }

  function spyOnWorkspaceCreation() {
    return vi.spyOn(aiService, "createWorkspace");
  }

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "hexawave-king-"));
    vi.stubEnv(
      "HEXAWAVE_PROJECT_OWNER_STORE",
      join(temporaryDirectory, "project-owners.json"),
    );
    vi.stubEnv(
      "HEXAWAVE_KING_REQUEST_STORE",
      join(temporaryDirectory, "king-requests.json"),
    );
    vi.stubEnv(
      "HEXAWAVE_BILLING_STORE",
      join(temporaryDirectory, "billing.json"),
    );
    aiService = new AiService();
    projectsService = new ProjectsService();
    service = new KingService(aiService, projectsService, new BillingService());
    workspaceSpy = spyOnWorkspaceCreation().mockImplementation(async (id) => ({
      success: true,
      project: { id },
    }));
    generateSpy = spyOnGenerate().mockResolvedValue({
      success: true,
      status: "ready",
      files: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("keeps requests pending until admin approval, then generates an owned workspace", async () => {
    const requester = { id: "company-user-1", email: "builder@example.com" };
    const created = service.createRequest(
      {
        companyName: "Northstar",
        productName: "Ledger",
        languages: ["TypeScript", "Python"],
        purpose: "Internal operations console",
      },
      requester,
    );

    expect(created.status).toBe("pending");
    expect(created.generationStatus).toBe("waiting");
    expect(service.listRequests(requester.id)).toHaveLength(1);
    expect(service.listRequests("another-user")).toHaveLength(0);
    expect(generateSpy.mock.calls).toHaveLength(0);

    const approved = await service.decide(
      created.id,
      "approved",
      { id: "admin-1", email: "admin@example.com" },
      "Reviewed",
    );
    expect(approved.status).toBe("approved");
    expect(approved.generationStatus).toBe("ready");
    expect(approved.projectId).toBeTruthy();
    expect(generateSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: approved.projectId,
        stack: "TypeScript + Python",
        generationMode: "full",
      }),
    );
    expect(projectsService.getOwnedProjects(requester.id)).toHaveLength(1);
    await expect(
      service.decide(created.id, "rejected", { id: "admin-1", email: "admin@example.com" }),
    ).rejects.toThrow(ConflictException);
  });

  it("allows an admin to retry failed generation without creating a duplicate workspace", async () => {
    const created = service.createRequest(
      {
        companyName: "Northstar",
        productName: "Ledger",
        purpose: "Internal operations console",
      },
      { id: "company-user-1", email: "builder@example.com" },
    );
    generateSpy
      .mockRejectedValueOnce(new Error("AI service temporarily unavailable"))
      .mockResolvedValueOnce({ success: true, status: "ready", files: [] });

    await expect(
      service.decide(created.id, "approved", { id: "admin-1", email: "admin@example.com" }),
    ).rejects.toThrow("AI service temporarily unavailable");
    const failed = service.listRequests()[0];
    expect(failed.generationStatus).toBe("failed");
    expect(failed.generationError).toContain("temporarily unavailable");
    expect(service.listRequests("company-user-1")[0]?.generationError).toBe(
      "Generation failed; an administrator can retry it.",
    );

    const retried = await service.retryGeneration(created.id);
    expect(retried.generationStatus).toBe("ready");
    expect(retried.projectId).toBe(failed.projectId);
    expect(workspaceSpy.mock.calls).toHaveLength(1);
  });

  it("exposes a defensive catalog and excludes offensive tooling", () => {
    const catalog = service.catalog();
    expect(catalog.languages).toContain("TypeScript");
    expect(catalog.securityControls.some((control) => control.id === "approval-gate")).toBe(true);
    expect(catalog.excluded.toLowerCase()).toContain("offensive");
  });

  it("persists approval requests across service restarts", () => {
    service.createRequest(
      {
        companyName: "Northstar",
        productName: "Ledger",
        purpose: "Internal operations console",
      },
      { id: "company-user-1", email: "builder@example.com" },
    );

    const restartedService = new KingService(
      aiService,
      projectsService,
      new BillingService(),
    );
    const [storedRequest] = restartedService.listRequests("company-user-1");
    expect(storedRequest.productName).toBe("Ledger");
    expect(storedRequest).not.toHaveProperty("requestedById");
  });
});
