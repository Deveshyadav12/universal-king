import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { AiService } from "../ai/ai.service";
import { Project, ProjectsService } from "./projects.service";
import { AuthenticatedUser } from "../users/users.service";
import { CurrentUser } from "../auth/auth.decorators";
import { BillingService } from "../billing/billing.service";

interface ProjectInput {
  name: string;
  type: string;
  stack: string;
  description: string;
}

interface GenerateInput {
  projectName: string;
  projectType: string;
  stack: string;
  prompt: string;
  generationMode?: "fast" | "full";
}

interface MaintenanceImportInput {
  projectName: string;
  archiveBase64: string;
}

interface GithubMaintenanceImportInput {
  repositoryUrl: string;
}

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly aiService: AiService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  async getProjects(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.aiService.getProjects();
    const projects = result.projects.map((project) =>
      this.projectsService.syncProject(project),
    );
    return {
      success: true,
      projects:
        user.role === "admin"
          ? projects
          : projects.filter((project) => project.ownerId === this.workspaceId(user)),
    };
  }

  @Post()
  async createProject(
    @Body() body: ProjectInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const id = this.projectsService.createId();
    const result = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.createWorkspace(id, body),
    );
    return this.projectsService.createProject(
      body,
      result.project.id,
      this.workspaceId(user),
    );
  }

  @Post("maintenance/import")
  async importMaintenanceProject(
    @Body() body: MaintenanceImportInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const projectId = this.projectsService.createId();
    const imported = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.importMaintenanceProject(
        projectId,
        body.projectName,
        body.archiveBase64,
      ),
    );
    const project = this.projectsService.syncProject(imported.project);
    this.projectsService.setOwner(project.id, this.workspaceId(user));
    project.ownerId = this.workspaceId(user);
    return {
      success: imported.success,
      project,
      files: imported.files,
      message: imported.message,
    };
  }

  @Post("maintenance/import-github")
  async importGithubMaintenanceProject(
    @Body() body: GithubMaintenanceImportInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const projectId = this.projectsService.createId();
    const imported = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.importGithubMaintenanceProject(
        projectId,
        body.repositoryUrl,
      ),
    );
    const project = this.projectsService.syncProject(imported.project);
    this.projectsService.setOwner(project.id, this.workspaceId(user));
    project.ownerId = this.workspaceId(user);
    return {
      success: imported.success,
      project,
      files: imported.files,
      message: imported.message,
    };
  }

  @Get(":id")
  async getProject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; project: Project }> {
    const result = await this.aiService.getProject(id);
    this.projectsService.syncProject(result.project);
    const ownedProject =
      user.role === "admin"
        ? this.projectsService.getProject(id)
        : this.projectsService.assertOwner(id, this.workspaceId(user));
    return {
      success: true,
      project: ownedProject,
    };
  }

  @Get(":id/status")
  async getStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    const [metadata, status] = await Promise.all([
      this.aiService.getProject(id),
      this.aiService.getProjectStatus(id),
    ]);
    const project = this.projectsService.syncProject({
      ...metadata.project,
      status: status.status,
      process: status.process,
    });
    return {
      success: true,
      project,
      status: project.status,
      process: project.process,
      output: status["output"],
    };
  }

  @Get(":id/files")
  async getFiles(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.aiService.getProjectFiles(id);
  }

  @Get(":id/download")
  async download(
    @Param("id") id: string,
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    const result = await this.aiService.downloadProject(id);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      result.contentDisposition ?? 'attachment; filename="hexawave-project.zip"',
    );
    response.send(result.buffer);
  }

  @Get(":id/files/:path")
  async getFile(
    @Param("id") id: string,
    @Param("path") filePath: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.aiService.getProjectFile(id, filePath);
  }

  @Put(":id/files/:path")
  async updateFile(
    @Param("id") id: string,
    @Param("path") filePath: string,
    @Body() body: { content: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.aiService.updateProjectFile(id, filePath, body.content);
  }

  @Post(":id/ai-edit")
  async editFileWithAi(
    @Param("id") id: string,
    @Body() body: { filePath: string; instruction: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.billingService.executeAiAction(user.id, () =>
      this.aiService.editProjectFile(id, body.filePath, body.instruction),
    );
  }

  @Post(":id/ai-maintain")
  async maintainProjectWithAi(
    @Param("id") id: string,
    @Body() body: { instruction: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.billingService.executeAiAction(user.id, () =>
      this.aiService.maintainProject(id, body.instruction),
    );
  }

  @Post(":id/ai-autonomous")
  async runAutonomousProjectTask(
    @Param("id") id: string,
    @Body() body: { instruction: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    return this.billingService.executeAiAction(user.id, () =>
      this.aiService.runAutonomousProjectTask(id, body.instruction),
    );
  }

  @Post(":id/generate")
  async generate(
    @Param("id") id: string,
    @Body() body: GenerateInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authorizeProject(id, user);
    const result = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.generate({ ...body, projectId: id }),
    );
    const project = await this.aiService.getProject(id);
    this.projectsService.syncProject(project.project);
    return result;
  }

  @Post(":id/build")
  async build(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.authorizeProject(id, user);
    const result = await this.aiService.buildProject(id);
    const metadata = await this.aiService.getProject(id);
    this.projectsService.syncProject(metadata.project);
    return result;
  }

  @Post(":id/run")
  async run(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.authorizeProject(id, user);
    const result = await this.aiService.runProject(id);
    const metadata = await this.aiService.getProject(id);
    this.projectsService.syncProject(metadata.project);
    return result;
  }

  @Post(":id/stop")
  async stop(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.authorizeProject(id, user);
    const result = await this.aiService.stopProject(id);
    const metadata = await this.aiService.getProject(id);
    this.projectsService.syncProject(metadata.project);
    return result;
  }

  private async authorizeProject(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Project> {
    const result = await this.aiService.getProject(id);
    this.projectsService.syncProject(result.project);
    return user.role === "admin"
      ? this.projectsService.getProject(id)
      : this.projectsService.assertOwner(id, this.workspaceId(user));
  }

  private workspaceId(user: AuthenticatedUser): string {
    return user.workspaceId ?? user.id;
  }
}
