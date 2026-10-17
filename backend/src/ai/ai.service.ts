import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const AI_URL = (
  process.env.HEXAWAVE_AI_URL || 'http://127.0.0.1:8000'
).trim().replace(/\/+$/, '');

export interface ProjectGenerationRequest {
  projectName: string;
  projectType: string;
  stack: string;
  prompt: string;
  projectId?: string;
  generationMode?: 'fast' | 'full';
}

export interface AiProjectMetadata {
  id: string;
  name?: string;
  type?: string;
  stack?: string;
  description?: string;
  status?: string;
  process?: {
    pid: number;
    port: number;
    status: string;
    startedAt: string;
  } | null;
  createdAt?: string;
  files?: string[];
}

export interface AiProjectResponse {
  success?: boolean;
  projectId?: string;
  status?: string;
  process?: AiProjectMetadata['process'];
  analysis?: unknown;
  files?: Array<{ name: string; language: string; content: string }>;
  build?: {
    passed?: boolean;
    attempts?: number;
    errors?: string[];
    stage?: string;
    stdout?: string;
    stderr?: string;
  };
  [key: string]: unknown;
}

export interface AiHealthResponse {
  success: boolean;
  service: string;
  status: 'online';
  version: string;
  workspaces: number;
}

export interface AiLeadScore {
  score: number;
  reasons: string[];
  qualification: 'HIGH_PRIORITY' | 'GOOD' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class AiService {
  private async fetchAi(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const serviceToken = process.env.HEXAWAVE_AI_SERVICE_TOKEN;
    const isProduction = ['HEXAWAVE_ENV', 'NODE_ENV', 'APP_ENV'].some(
      (name) => process.env[name]?.trim().toLowerCase() === 'production',
    );
    if (!serviceToken && isProduction) {
      throw new ServiceUnavailableException(
        'HexaWave AI service authentication is not configured.',
      );
    }

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (serviceToken) {
      headers.set('X-Hexawave-Service-Token', serviceToken);
    }

    let response: Response;
    try {
      response = await fetch(`${AI_URL}${path}`, {
        ...options,
        headers,
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unknown network error';
      throw new ServiceUnavailableException(
        `HexaWave AI service is unavailable: ${detail}`,
      );
    }

    if (!response.ok) {
      const detail = await response.text();
      const status = response.status >= 500 ? 502 : response.status;
      throw new HttpException(
        `AI service ${path} returned ${response.status}: ${detail}`,
        status,
      );
    }
    return response;
  }

  private async fetchJson<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await this.fetchAi(path, options);
    return (await response.json()) as T;
  }

  async createWorkspace(
    id: string,
    data: {
      name: string;
      type: string;
      stack: string;
      description: string;
    },
  ): Promise<{ success: boolean; project: AiProjectMetadata }> {
    return this.fetchJson('/projects', {
      method: 'POST',
      body: JSON.stringify({
        projectId: id,
        name: data.name,
        type: data.type,
        stack: data.stack,
        description: data.description,
      }),
    });
  }

  async importMaintenanceProject(
    projectId: string,
    projectName: string,
    archiveBase64: string,
  ): Promise<{
    success: boolean;
    project: AiProjectMetadata;
    files: string[];
    message: string;
  }> {
    return this.fetchJson('/projects/maintenance/import', {
      method: 'POST',
      body: JSON.stringify({ projectId, projectName, archiveBase64 }),
    });
  }

  async importGithubMaintenanceProject(
    projectId: string,
    repositoryUrl: string,
  ): Promise<{
    success: boolean;
    project: AiProjectMetadata;
    files: string[];
    message: string;
  }> {
    return this.fetchJson('/projects/maintenance/import-github', {
      method: 'POST',
      body: JSON.stringify({ projectId, repositoryUrl }),
    });
  }

  async getProjects(): Promise<{
    success: boolean;
    projects: AiProjectMetadata[];
  }> {
    return this.fetchJson('/projects');
  }

  async getHealth(): Promise<AiHealthResponse> {
    return this.fetchJson('/health');
  }

  async scoreLead(lead: Record<string, unknown>): Promise<AiLeadScore> {
    try {
      const result = await this.fetchJson<unknown>('/lead/score', {
        method: 'POST',
        body: JSON.stringify({ lead }),
      });

      if (
        typeof result === 'object' &&
        result !== null &&
        'score' in result &&
        typeof result.score === 'number' &&
        Number.isInteger(result.score) &&
        result.score >= 0 &&
        result.score <= 100 &&
        'reasons' in result &&
        Array.isArray(result.reasons) &&
        result.reasons.every((reason) => typeof reason === 'string') &&
        'qualification' in result &&
        typeof result.qualification === 'string' &&
        ['HIGH_PRIORITY', 'GOOD', 'MEDIUM', 'LOW'].includes(
          result.qualification,
        )
      ) {
        return {
          score: result.score,
          reasons: result.reasons as string[],
          qualification: result.qualification as AiLeadScore['qualification'],
        };
      }

      throw new Error('Invalid AI lead score response');
    } catch (error: unknown) {
      // Keep lead scoring available when the separate AI service is unavailable.
      const detail = error instanceof Error ? error.message : 'Unknown error';
      console.error(`AI lead scoring unavailable; using fallback: ${detail}`);

      const profileText = [
        lead['companyName'],
        lead['company_name'],
        lead['industry'],
        lead['website'],
        lead['description'],
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      const hasWebsite =
        typeof lead['website'] === 'string' &&
        lead['website'].trim().length > 0;
      const hasEmail =
        typeof lead['email'] === 'string' &&
        lead['email'].trim().length > 0;
      const hasUsefulProfile = profileText.trim().length > 20;

      const score = Math.min(
        100,
        20 +
          (hasWebsite ? 20 : 0) +
          (hasEmail ? 20 : 0) +
          (hasUsefulProfile ? 10 : 0),
      );

      return {
        score,
        reasons: [
          'Fallback score: AI service unavailable',
          `Basic profile score: ${score}`,
        ],
        qualification:
          score >= 70
            ? 'HIGH_PRIORITY'
            : score >= 50
              ? 'GOOD'
              : score >= 35
                ? 'MEDIUM'
                : 'LOW',
      };
    }
  }

  async getProject(
    id: string,
  ): Promise<{ success: boolean; project: AiProjectMetadata }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}`);
  }

  async generate(data: ProjectGenerationRequest): Promise<AiProjectResponse> {
    const endpoint = data.projectId
      ? `/projects/${encodeURIComponent(data.projectId)}/generate`
      : '/generate';
    return this.fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateZip(data: ProjectGenerationRequest): Promise<{
    buffer: Buffer;
    contentDisposition: string | null;
  }> {
    const response = await this.fetchAi('/generate/zip', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  async preview(data: ProjectGenerationRequest): Promise<string> {
    const response = await this.fetchAi('/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.text();
  }

  async getProjectStatus(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/status`);
  }

  async getProjectFiles(id: string): Promise<{
    success: boolean;
    projectId: string;
    files: string[];
  }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/files`);
  }

  async getProjectFile(
    id: string,
    filePath: string,
  ): Promise<{
    success: boolean;
    path: string;
    content: string;
  }> {
    const encodedPath = encodeURIComponent(filePath);
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/files/${encodedPath}`,
    );
  }

  async updateProjectFile(id: string, filePath: string, content: string) {
    const encodedPath = encodeURIComponent(filePath);
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/files/${encodedPath}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      },
    );
  }

  async editProjectFile(
    id: string,
    filePath: string,
    instruction: string,
  ): Promise<{
    success: boolean;
    path: string;
    content: string;
  }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/ai-edit`, {
      method: 'POST',
      body: JSON.stringify({ filePath, instruction }),
    });
  }

  async maintainProject(
    id: string,
    instruction: string,
  ): Promise<{
    success: boolean;
    summary: string;
    changedFiles: string[];
    excludedFileCount: number;
  }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/ai-maintain`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    });
  }

  async runAutonomousProjectTask(
    id: string,
    instruction: string,
  ): Promise<{
    success: boolean;
    summary: string;
    changedFiles: string[];
    excludedFileCount: number;
    test: { passed: boolean; errors: string[] };
    runtimeTests: {
      passed: boolean;
      skipped: boolean;
      errors: string[];
      stdout?: string;
      stderr?: string;
    };
    build: {
      passed: boolean;
      attempts: number;
      stage?: string;
      errors: string[];
      stdout?: string;
      stderr?: string;
    };
  }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/ai-autonomous`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    });
  }

  async buildProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/build`, {
      method: 'POST',
    });
  }

  async downloadProject(id: string): Promise<{
    buffer: Buffer;
    contentDisposition: string | null;
  }> {
    const response = await this.fetchAi(
      `/projects/${encodeURIComponent(id)}/download`,
    );
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  async runProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    });
  }

  async stopProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
    });
  }
}
