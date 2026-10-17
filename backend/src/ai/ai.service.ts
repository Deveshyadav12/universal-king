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
