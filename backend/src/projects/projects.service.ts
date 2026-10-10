import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AiProjectMetadata } from "../ai/ai.service";

export type ProjectStatus =
  | "created"
  | "planning"
  | "architecting"
  | "coding"
  | "testing"
  | "building"
  | "fixing"
  | "ready"
  | "failed"
  | "running"
  | "stopped";

export interface ProjectProcess {
  pid: number;
  port: number;
  status: string;
  startedAt: string;
  script?: string;
}

export interface Project {
  id: string;
  name: string;
  type: string;
  stack: string;
  description: string;
  status: ProjectStatus;
  process: ProjectProcess | null;
  createdAt: string;
  ownerId: string;
}

@Injectable()
export class ProjectsService {
  private readonly projects = new Map<string, Project>();
  private readonly owners = new Map<string, string>();
  private ownersLoaded = false;
  private readonly ownerStorePath = resolve(
    process.env.HEXAWAVE_PROJECT_OWNER_STORE ?? "data/project-owners.json",
  );

  createId(): string {
    return randomUUID();
  }

  getProjects() {
    return {
      success: true,
      projects: Array.from(this.projects.values()),
    };
  }

  getOwnedProjects(ownerId: string): Project[] {
    return Array.from(this.projects.values()).filter(
      (project) => project.ownerId === ownerId,
    );
  }

  assertOwner(id: string, ownerId: string): Project {
    this.loadOwners();
    const project = this.projects.get(id);
    if (!project || project.ownerId !== ownerId) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    return project;
  }

  getProject(id: string): Project {
    const project = this.projects.get(id);

    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    return project;
  }

  createProject(data: {
    name: string;
    type: string;
    stack: string;
    description: string;
  }, id: string, ownerId: string): { success: true; project: Project } {
    this.loadOwners();
    const project: Project = {
      id,
      name: data.name,
      type: data.type,
      stack: data.stack,
      description: data.description,
      status: "created",
      process: null,
      createdAt: new Date().toISOString(),
      ownerId,
    };

    this.projects.set(id, project);
    this.owners.set(id, ownerId);
    this.persistOwners();

    return { success: true, project };
  }

  syncProject(metadata: AiProjectMetadata): Project {
    const existing = this.projects.get(metadata.id);
    const project: Project = {
      id: metadata.id,
      name: metadata.name ?? existing?.name ?? "Untitled project",
      type: metadata.type ?? existing?.type ?? "Web App",
      stack: metadata.stack ?? existing?.stack ?? "Next.js + TypeScript",
      description: metadata.description ?? existing?.description ?? "",
      status: this.isProjectStatus(metadata.status)
        ? metadata.status
        : existing?.status ?? "created",
      process: metadata.process ?? existing?.process ?? null,
      createdAt: metadata.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      ownerId: existing?.ownerId ?? this.getOwner(metadata.id) ?? "",
    };
    this.projects.set(project.id, project);
    return project;
  }

  setOwner(id: string, ownerId: string): void {
    this.loadOwners();
    this.owners.set(id, ownerId);
    const project = this.projects.get(id);
    if (project) project.ownerId = ownerId;
    this.persistOwners();
  }

  private isProjectStatus(status: string | undefined): status is ProjectStatus {
    return status !== undefined && [
      "created",
      "planning",
      "architecting",
      "coding",
      "testing",
      "building",
      "fixing",
      "ready",
      "failed",
      "running",
      "stopped",
    ].includes(status);
  }

  private getOwner(id: string): string | undefined {
    this.loadOwners();
    return this.owners.get(id);
  }

  private loadOwners(): void {
    if (this.ownersLoaded) return;
    this.ownersLoaded = true;
    if (!existsSync(this.ownerStorePath)) return;
    const parsed: unknown = JSON.parse(readFileSync(this.ownerStorePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Project ownership store has an invalid format.");
    }
    for (const [projectId, ownerId] of Object.entries(parsed)) {
      if (typeof ownerId !== "string") {
        throw new Error("Project ownership store has an invalid owner entry.");
      }
      this.owners.set(projectId, ownerId);
    }
  }

  private persistOwners(): void {
    mkdirSync(dirname(this.ownerStorePath), { recursive: true });
    const temporaryPath = `${this.ownerStorePath}.${randomUUID()}.tmp`;
    writeFileSync(
      temporaryPath,
      JSON.stringify(Object.fromEntries(this.owners), null, 2),
      { encoding: "utf8", mode: 0o600 },
    );
    renameSync(temporaryPath, this.ownerStorePath);
  }

  setStatus(id: string, status: ProjectStatus): Project {
    const project = this.getProject(id);
    project.status = status;
    this.projects.set(id, project);
    return project;
  }

  setProcess(id: string, process: ProjectProcess | null): Project {
    const project = this.getProject(id);
    project.process = process;
    this.projects.set(id, project);
    return project;
  }
}
