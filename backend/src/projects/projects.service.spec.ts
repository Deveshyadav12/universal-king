import { NotFoundException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './projects.service';

describe('ProjectsService ownership', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('persists ownership across backend service restarts and blocks other users', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-projects-'));
    vi.stubEnv('HEXAWAVE_PROJECT_OWNER_STORE', join(directory, 'owners.json'));
    try {
      const original = new ProjectsService();
      const id = original.createId();
      original.createProject(
        {
          name: 'Private app',
          type: 'Web App',
          stack: 'Next.js',
          description: 'Private workspace',
        },
        id,
        'owner-a',
      );
      expect(() => original.assertOwner(id, 'owner-b')).toThrow(
        NotFoundException,
      );

      const restarted = new ProjectsService();
      restarted.syncProject({ id, name: 'Private app' });
      expect(restarted.assertOwner(id, 'owner-a').name).toBe('Private app');
      expect(() => restarted.assertOwner(id, 'owner-b')).toThrow(
        NotFoundException,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
