import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

@Injectable()
export class TradingFeatureService {
  private readonly storePath = resolve(
    process.env.HEXAWAVE_TRADING_FEATURE_STORE ?? 'data/trading-feature.json',
  );
  private enabled = this.loadEnabled();

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): { enabled: boolean } {
    const directory = dirname(this.storePath);
    mkdirSync(directory, { recursive: true });
    writeFileSync(this.storePath, `${JSON.stringify({ enabled }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    this.enabled = enabled;
    return { enabled };
  }

  private loadEnabled(): boolean {
    if (!existsSync(this.storePath)) return false;
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(this.storePath, 'utf8'));
    } catch (error) {
      throw new Error('Trading feature settings store is invalid.', {
        cause: error,
      });
    }
    if (
      typeof data !== 'object' ||
      data === null ||
      !('enabled' in data) ||
      typeof data.enabled !== 'boolean'
    ) {
      throw new Error('Trading feature settings store is invalid.');
    }
    return data.enabled;
  }
}
