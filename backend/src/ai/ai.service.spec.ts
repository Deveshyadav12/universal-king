import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service';

describe('AiService internal authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the configured service token to the AI service', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('HEXAWAVE_AI_SERVICE_TOKEN', 'test-internal-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, projects: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new AiService().getProjects();

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('X-Hexawave-Service-Token')).toBe('test-internal-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not call the AI service in production without a token', async () => {
    vi.stubEnv('HEXAWAVE_ENV', 'production');
    vi.stubEnv('HEXAWAVE_AI_SERVICE_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new AiService().getProjects()).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
