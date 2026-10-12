import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiService } from "../ai/ai.service";
import { BillingService } from "../billing/billing.service";
import { ProjectsController } from "./projects.controller";
import type { Project } from "./projects.service";
import { ProjectsService } from "./projects.service";
import { DeploymentService } from "./deployment.service";

function createFreeBillingService(): BillingService {
  const directory = mkdtempSync(join(tmpdir(), "hexawave-project-billing-"));
  const previousPath = process.env.HEXAWAVE_BILLING_STORE;
  process.env.HEXAWAVE_BILLING_STORE = join(directory, "billing.json");
  try {
    return new BillingService();
  } finally {
    if (previousPath === undefined) delete process.env.HEXAWAVE_BILLING_STORE;
    else process.env.HEXAWAVE_BILLING_STORE = previousPath;
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("ProjectsController maintenance import", () => {
  it("authorizes project ownership before running autonomous work", async () => {
    const projectsService = new ProjectsService();
    const projectId = "963b1576-6d44-4ce2-a1a5-0948e4cd6481";
    const project: Project = {
      id: projectId,
      name: "Existing app",
      type: "Web App",
      stack: "Next.js",
      description: "Autonomous test",
      status: "created",
      process: null,
      createdAt: new Date().toISOString(),
      ownerId: "northstar-company",
    };
    vi.spyOn(projectsService, "syncProject").mockReturnValue(project);
    const assertOwner = vi.spyOn(projectsService, "assertOwner").mockReturnValue(project);
    const aiService = new AiService();
    vi.spyOn(aiService, "getProject").mockResolvedValue({
      success: true,
      project: { id: projectId, name: "Existing app" },
    });
    vi.spyOn(aiService, "runAutonomousProjectTask").mockResolvedValue({
      success: true,
      summary: "Checks passed.",
      changedFiles: ["src/app.ts"],
      excludedFileCount: 0,
      test: { passed: true, errors: [] },
      runtimeTests: { passed: true, skipped: false, errors: [] },
      build: { passed: true, attempts: 1, errors: [] },
    });
    const controller = new ProjectsController(
      projectsService,
      aiService,
      createFreeBillingService(),
      new DeploymentService(),
    );

    const result = await controller.runAutonomousProjectTask(
      projectId,
      { instruction: "Add a health endpoint" },
      {
        id: "employee-user",
        email: "employee@example.com",
        name: "Employee",
        role: "user",
        workspaceId: "northstar-company",
      },
    );

    expect(result.success).toBe(true);
    expect(assertOwner).toHaveBeenCalledWith(projectId, "northstar-company");
    expect(aiService.runAutonomousProjectTask).toHaveBeenCalledWith(
      projectId,
      "Add a health endpoint",
    );
  });

  it("authorizes a project before requesting AI-wide maintenance", async () => {
    const projectsService = new ProjectsService();
    const projectId = "963b1576-6d44-4ce2-a1a5-0948e4cd6481";
    const project: Project = {
      id: projectId,
      name: "Existing app",
      type: "Web App",
      stack: "Next.js",
      description: "Maintenance test",
      status: "created",
      process: null,
      createdAt: new Date().toISOString(),
      ownerId: "northstar-company",
    };
    vi.spyOn(projectsService, "syncProject").mockReturnValue(project);
    const assertOwner = vi.spyOn(projectsService, "assertOwner").mockReturnValue(project);
    const aiService = new AiService();
    vi.spyOn(aiService, "getProject").mockResolvedValue({
      success: true,
      project: { id: projectId, name: "Existing app" },
    });
    vi.spyOn(aiService, "maintainProject").mockResolvedValue({
      success: true,
      summary: "Added a health endpoint.",
      changedFiles: ["src/health.ts"],
      excludedFileCount: 1,
    });
    const controller = new ProjectsController(
      projectsService,
      aiService,
      createFreeBillingService(),
      new DeploymentService(),
    );

    const result = await controller.maintainProjectWithAi(
      projectId,
      { instruction: "Add a health endpoint" },
      {
        id: "test-owner",
        email: "test@example.com",
        name: "Test Owner",
        role: "user",
        workspaceId: "northstar-company",
      },
    );

    expect(result.changedFiles).toEqual(["src/health.ts"]);
    expect(assertOwner).toHaveBeenCalledWith(projectId, "northstar-company");
    expect(aiService.maintainProject).toHaveBeenCalledWith(
      projectId,
      "Add a health endpoint",
    );
  });

  it("routes public GitHub imports through the AI service into a new workspace", async () => {
    const projectsService = new ProjectsService();
    vi.spyOn(projectsService, "setOwner").mockImplementation((id, ownerId) => {
      projectsService.getProject(id).ownerId = ownerId;
    });
    const aiService = new AiService();
    const repositoryUrl = "https://github.com/owner/repository";
    vi.spyOn(aiService, "importGithubMaintenanceProject").mockImplementation(
      async (projectId, receivedUrl) => ({
        success: true,
        project: {
          id: projectId,
          name: "repository",
          type: "Existing App Maintenance",
          stack: "Next.js / JavaScript",
          description: "Imported repository",
          status: "created",
        },
        files: ["README.md", "package.json"],
        message: `Imported ${receivedUrl}`,
      }),
    );
    let app: INestApplication | undefined;
    try {
      const module = await Test.createTestingModule({
        controllers: [ProjectsController],
        providers: [
          { provide: ProjectsService, useValue: projectsService },
          { provide: AiService, useValue: aiService },
          { provide: BillingService, useValue: createFreeBillingService() },
          { provide: DeploymentService, useValue: new DeploymentService() },
        ],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix("api");
      app.use(
        (
          requestWithUser: Request & {
            user?: {
              id: string;
              email: string;
              name: string;
              role: "user";
              workspaceId: string;
            };
          },
          _response: Response,
          next: NextFunction,
        ) => {
          requestWithUser.user = {
            id: "test-owner",
            email: "test@example.com",
            name: "Test Owner",
            role: "user",
            workspaceId: "northstar-company",
          };
          next();
        },
      );
      await app.init();

      const response = await request(app.getHttpServer())
        .post("/api/projects/maintenance/import-github")
        .send({ repositoryUrl })
        .expect(201);
      const body: {
        success: boolean;
        project: { id: string; name: string };
        files: string[];
        message: string;
      } = response.body;

      expect(body.success).toBe(true);
      expect(body.project.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(body.project.name).toBe("repository");
      expect(
        projectsService.assertOwner(body.project.id, "northstar-company").ownerId,
      ).toBe("northstar-company");
      expect(body.files).toEqual(["README.md", "package.json"]);
      expect(body.message).toBe(`Imported ${repositoryUrl}`);
      expect(aiService.importGithubMaintenanceProject).toHaveBeenCalledWith(
        body.project.id,
        repositoryUrl,
      );
    } finally {
      await app?.close();
    }
  });
});
