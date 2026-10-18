
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface ProjectGenerationRequest {
  [key: string]: unknown;
}

export interface AiProjectResponse {
  [key: string]: unknown;
  success?: boolean;
  projectId?: string;
  id?: string;
  status?: string;
  message?: string;
}

interface ZipDownloadResponse {
  buffer: Buffer;
  contentDisposition: string | null;
}

interface ProjectFilesResponse {
  success: boolean;
  projectId: string;
  files: string[];
}

interface ProjectFileResponse {
  success: boolean;
  path: string;
  content: string;
}

interface MaintenanceResponse {
  success: boolean;
  summary: string;
  changedFiles: string[];
  excludedFileCount: number;
}

interface TestResult {
  passed: boolean;
  errors: string[];
  skipped?: boolean;
  stdout?: string;
  stderr?: string;
}

interface BuildResult {
  passed: boolean;
  attempts: number;
  stage?: string;
  errors: string[];
  stdout?: string;
  stderr?: string;
}

interface AutonomousTaskResponse extends MaintenanceResponse {
  test: TestResult;
  runtimeTests: TestResult;
  build: BuildResult;
}

@Injectable()
export class AiService {
  private readonly baseUrl = (
    process.env.AI_SERVICE_URL || 'http://localhost:8000'
  ).replace(/\/+$/, '');

  private readonly requestTimeoutMs = 120_000;

  private async fetchAi(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers(options.headers);
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (internalToken) {
      headers.set('x-internal-service-token', internalToken);
    }

    if (options.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    if (!headers.has('accept')) {
      headers.set('accept', '*/*');
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';

      throw new ServiceUnavailableException(
        `AI service is unavailable: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const details = errorBody.slice(0, 2000);

      throw new BadGatewayException(
        `AI service returned HTTP ${response.status}${
          details ? `: ${details}` : ''
        }`,
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
      return undefined as T;
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new BadGatewayException(
        `AI service returned invalid JSON for ${path}`,
      );
    }
  }

  async generateProjectZip(
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
    return this.fetchJson<AiProjectResponse>(
      `/projects/${encodeURIComponent(id)}/status`,
    );
  }

  async getProjectFiles(id: string): Promise<ProjectFilesResponse> {
    return this.fetchJson<ProjectFilesResponse>(
      `/projects/${encodeURIComponent(id)}/files`,
    );
  }

  async getProjectFile(
    id: string,
    filePath: string,
  ): Promise<ProjectFileResponse> {
    const encodedPath = encodeURIComponent(filePath);

    return this.fetchJson<ProjectFileResponse>(
      `/projects/${encodeURIComponent(id)}/files/${encodedPath}`,
    );
  }

  async updateProjectFile(
    id: string,
    filePath: string,
    content: string,
  ): Promise<ProjectFileResponse> {
    const encodedPath = encodeURIComponent(filePath);

    return this.fetchJson<ProjectFileResponse>(
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
  ): Promise<ProjectFileResponse> {
    return this.fetchJson<ProjectFileResponse>(
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
    return this.fetchJson<MaintenanceResponse>(
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
    return this.fetchJson<AutonomousTaskResponse>(
      `/projects/${encodeURIComponent(id)}/ai-autonomous`,
      {
        method: 'POST',
        body: JSON.stringify({ instruction }),
      },
    );
  }

  async buildProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson<AiProjectResponse>(
      `/projects/${encodeURIComponent(id)}/build`,
      {
        method: 'POST',
      },
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
    return this.fetchJson<AiProjectResponse>(
      `/projects/${encodeURIComponent(id)}/run`,
      {
        method: 'POST',
      },
    );
  }

  async stopProject(id: string): Promise<AiProjectResponse> {
    return this.fetchJson<AiProjectResponse>(
      `/projects/${encodeURIComponent(id)}/stop`,
      {
        method: 'POST',
      },
    );
  }
}
