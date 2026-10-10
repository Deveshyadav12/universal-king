import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TradingFeatureControl,
  TradingFeatureGuard,
} from './trading-feature.guard';
import { TradingFeatureService } from './trading-feature.service';

class FeatureRoutes {
  @TradingFeatureControl()
  control(this: void): void {}

  tradingAction(this: void): void {}
}

describe('TradingFeatureGuard', () => {
  let storeDirectory: string;
  let feature: TradingFeatureService;
  const reflector = new Reflector();

  beforeEach(() => {
    storeDirectory = mkdtempSync(join(tmpdir(), 'hexawave-trading-guard-'));
    vi.stubEnv(
      'HEXAWAVE_TRADING_FEATURE_STORE',
      join(storeDirectory, 'settings.json'),
    );
    feature = new TradingFeatureService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  function context(handler: () => void): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => FeatureRoutes,
    } as ExecutionContext;
  }

  it('rejects trading routes while disabled but permits the King control route', () => {
    const guard = new TradingFeatureGuard(reflector, feature);

    expect(() =>
      guard.canActivate(context(FeatureRoutes.prototype.tradingAction)),
    ).toThrow(/currently disabled/);
    expect(guard.canActivate(context(FeatureRoutes.prototype.control))).toBe(
      true,
    );
  });

  it('allows routes after the feature is enabled', () => {
    feature.setEnabled(true);
    const guard = new TradingFeatureGuard(reflector, feature);

    expect(
      guard.canActivate(context(FeatureRoutes.prototype.tradingAction)),
    ).toBe(true);
  });
});
