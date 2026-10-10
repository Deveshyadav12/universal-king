import { MarketDataService } from './market-data.service';
import { TradingService } from './trading.service';
import { TradingFeatureService } from './trading-feature.service';
import type { MarketQuote } from './trading.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type QuoteListener = Parameters<MarketDataService['registerListener']>[0];

class TestMarketDataService extends MarketDataService {
  private listener: QuoteListener | undefined;
  private currentQuote: MarketQuote | undefined;

  override addSymbol(symbol: string): string[] {
    return [symbol];
  }

  override quote(symbol: string): MarketQuote | undefined {
    return this.currentQuote?.symbol === symbol ? this.currentQuote : undefined;
  }

  override registerListener(listener: QuoteListener): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  override startPolling(): void {}

  async publish(price: number): Promise<void> {
    const quote: MarketQuote = {
      symbol: 'STOCK',
      price,
      bid: price,
      ask: price,
      source: 'simulator',
      observedAt: new Date().toISOString(),
    };
    this.currentQuote = quote;
    await this.listener?.([quote]);
  }
}

describe('TradingService baseline automation', () => {
  let storeDirectory: string;

  beforeEach(() => {
    storeDirectory = mkdtempSync(join(tmpdir(), 'hexawave-trading-service-'));
    vi.stubEnv(
      'HEXAWAVE_TRADING_FEATURE_STORE',
      join(storeDirectory, 'settings.json'),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  it('paper-buys above 200 and sells below 200 on incoming quotes', async () => {
    const tradingFeature = new TradingFeatureService();
    tradingFeature.setEnabled(true);
    const marketData = new TestMarketDataService();
    const trading = new TradingService(marketData, tradingFeature);
    trading.onModuleInit();

    const strategy = trading.listStrategies()[0];
    trading.updateStrategy(strategy.id, {
      risk: { cooldownMs: 0, stopLossPercent: 0, takeProfitPercent: 0 },
    });
    trading.startStrategy(strategy.id);
    trading.setArmed(strategy.id, true);

    await marketData.publish(200);
    expect(trading.listOrders()).toHaveLength(0);

    await marketData.publish(200.01);
    expect(trading.listPositions()).toMatchObject([
      { strategyId: strategy.id, side: 'long', quantity: 1 },
    ]);

    await marketData.publish(199.99);
    expect(
      trading
        .listOrders()
        .map((order) => order.side)
        .reverse(),
    ).toEqual(['buy', 'sell']);
    expect(trading.listPositions()).toHaveLength(0);

    trading.onModuleDestroy();
    marketData.onModuleDestroy();
  });

  it('ignores quotes and rejects manual ticks while the feature is disabled', async () => {
    const tradingFeature = new TradingFeatureService();
    tradingFeature.setEnabled(false);
    const marketData = new TestMarketDataService();
    const trading = new TradingService(marketData, tradingFeature);
    trading.onModuleInit();
    const strategy = trading.listStrategies()[0];
    trading.startStrategy(strategy.id);
    trading.setArmed(strategy.id, true);

    await marketData.publish(201);
    expect(trading.listOrders()).toHaveLength(0);
    await expect(trading.runTick()).rejects.toThrow(/currently disabled/);

    trading.disableAutomation();
    expect(trading.getStrategy(strategy.id)).toMatchObject({
      state: 'stopped',
      armed: false,
    });
    trading.onModuleDestroy();
    marketData.onModuleDestroy();
  });
});
