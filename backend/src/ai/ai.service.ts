
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const AI_URL = (
  process.env.HEXAWAVE_AI_URL || 'http://127.0.0.1:8000'
)
  .trim()
  .replace(/\/+$/, '');

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
  ownerId?: string;
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
  id?: string;
  status?: string;
  message?: string;
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

export interface ZipDownloadResponse {
  buffer: Buffer;
  contentDisposition: string | null;
}

export interface ProjectFilesResponse {
  success: boolean;
  projectId: string;
  files: string[];
}

export interface ProjectFileResponse {
  success: boolean;
  path: string;
  content: string;
}

export interface MaintenanceResponse {
  success: boolean;
  summary: string;
  changedFiles: string[];
  excludedFileCount: number;
}

export interface TestResult {
  passed: boolean;
  errors: string[];
  skipped?: boolean;
  stdout?: string;
  stderr?: string;
}

export interface BuildResult {
  passed: boolean;
  attempts: number;
  stage?: string;
  errors: string[];
  stdout?: string;
  stderr?: string;
}

export interface AutonomousTaskResponse extends MaintenanceResponse {
  test: TestResult;
  runtimeTests: TestResult;
  build: BuildResult;
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

    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    headers.set('accept', headers.get('accept') || 'application/json');

    if (serviceToken) {
      headers.set('X-Hexawave-Service-Token', serviceToken);
    }

    let response: Response;

    try {
      response = await fetch(`${AI_URL}${path}`, {
        ...options,
        headers,
        signal: options.signal,
      });
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : 'Unknown network error';

      throw new ServiceUnavailableException(
        `HexaWave AI service is unavailable: ${detail}`,
      );
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 2000);
      const status = response.status >= 500 ? 502 : response.status;

      throw new HttpException(
        `AI service ${path} returned ${response.status}${
          detail ? `: ${detail}` : ''
        }`,
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
    const body = await response.text();

    if (!body.trim()) {
      throw new HttpException(
        `AI service returned an empty response for ${path}`,
        502,
      );
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new HttpException(
        `AI service returned invalid JSON for ${path}`,
        502,
      );
    }
  }

  async getHealth(): Promise<AiHealthResponse> {
    return this.fetchJson<AiHealthResponse>('/health');
  }

  async getProjects(): Promise<{
    success: boolean;
    projects: AiProjectMetadata[];
  }> {
    return this.fetchJson('/projects');
  }

  async getProject(
    id: string,
  ): Promise<{ success: boolean; project: AiProjectMetadata }> {
    return this.fetchJson(`/projects/${encodeURIComponent(id)}`);
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

  async generate(
    data: ProjectGenerationRequest,
  ): Promise<AiProjectResponse> {
    const endpoint = data.projectId
      ? `/projects/${encodeURIComponent(data.projectId)}/generate`
      : '/generate';

    return this.fetchJson<AiProjectResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateZip(
    data: ProjectGenerationRequest,
  ): Promise<ZipDownloadResponse> {
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
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/status`,
    );
  }

  async getProjectFiles(id: string): Promise<ProjectFilesResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/files`,
    );
  }

  async getProjectFile(
    id: string,
    filePath: string,
  ): Promise<ProjectFileResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(filePath)}`,
    );
  }

  async updateProjectFile(
    id: string,
    filePath: string,
    content: string,
  ): Promise<ProjectFileResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(filePath)}`,
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
  ): Promise<ProjectFileResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/ai-edit`,
      {
        method: 'POST',
        body: JSON.stringify({ filePath, instruction }),
      },
    );
  }

  async maintainProject(
    id: string,
    instruction: string,
  ): Promise<MaintenanceResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/ai-maintain`,
      {
        method: 'POST',
        body: JSON.stringify({ instruction }),
      },
    );
  }

  async runAutonomousProjectTask(
    id: string,
    instruction: string,
  ): Promise<AutonomousTaskResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/ai-autonomous`,
      {
        method: 'POST',
        body: JSON.stringify({ instruction }),
      },
    );
  }

  async buildProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/build`,
      { method: 'POST' },
    );
  }

  async downloadProject(id: string): Promise<ZipDownloadResponse> {
    const response = await this.fetchAi(
      `/projects/${encodeURIComponent(id)}/download`,
    );

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  async runProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/run`,
      { method: 'POST' },
    );
  }

  async stopProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson(
      `/projects/${encodeURIComponent(id)}/stop`,
      { method: 'POST' },
    );
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

  async scoreLead(lead: object): Promise<AiLeadScore> {
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
          qualification:
            result.qualification as AiLeadScore['qualification'],
        };
      }

      throw new Error('Invalid AI lead score response');
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : 'Unknown error';

      // Fallback keeps lead qualification available while AI is offline.
      console.error(
        `AI lead scoring unavailable; using fallback: ${detail}`,
      );

      const data = lead as Record<string, unknown>;
      const profileText = [
        data['companyName'],
        data['company_name'],
        data['industry'],
        data['website'],
        data['description'],
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      const hasWebsite =
        typeof data['website'] === 'string' &&
        data['website'].trim().length > 0;

      const hasEmail =
        typeof data['email'] === 'string' &&
        data['email'].trim().length > 0;

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
}
