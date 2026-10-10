import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradingFeatureService } from './trading-feature.service';

describe('TradingFeatureService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults off and persists an administrator's choice", () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-trading-feature-'));
    const storePath = join(directory, 'settings.json');
    vi.stubEnv('HEXAWAVE_TRADING_FEATURE_STORE', storePath);

    try {
      const feature = new TradingFeatureService();
      expect(feature.isEnabled()).toBe(false);
      expect(feature.setEnabled(true)).toEqual({ enabled: true });
      expect(JSON.parse(readFileSync(storePath, 'utf8'))).toEqual({
        enabled: true,
      });

      expect(new TradingFeatureService().isEnabled()).toBe(true);
      expect(feature.setEnabled(false)).toEqual({ enabled: false });
      expect(new TradingFeatureService().isEnabled()).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
