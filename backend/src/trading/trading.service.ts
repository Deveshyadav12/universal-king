/**
 * Orchestrates the baseline automation: it turns rule decisions into positions,
 * orders, and journal entries, and enforces the operator approval gate.
 *
 * Rule, per strategy:
 *   price above the baseline -> BUY
 *   price below the baseline -> SELL
 *   otherwise                -> HOLD
 *
 * Live execution is deliberately not wired to a broker. Paper accounting is
 * fully implemented, and a strategy set to `live` is rejected until a broker
 * adapter is configured, so no order can silently leave this process.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_BASELINE_PRICE,
  EXECUTION_MODES,
  POSITION_SIDES,
  SELL_BEHAVIOURS,
  TRADING_DEFAULTS,
  TRADING_LIMITS,
} from './trading.constants';
import type {
  CreateStrategyInput,
  EquityPoint,
  ExecutionOutcome,
  SignalAction,
  SignalReason,
  StrategyPerformance,
  StrategyRisk,
  StrategyTick,
  TradingAuditEvent,
  TradingOrder,
  TradingOverview,
  TradingPosition,
  TradingSignal,
  TradingStrategy,
  UpdateStrategyInput,
  MarketQuote,
} from './trading.types';
import { MarketDataService } from './market-data.service';
import { TradingFeatureService } from './trading-feature.service';
import { normalizeSymbol } from './market-data.providers';
import {
  actionToOrderSide,
  applyPositionFilter,
  computeBounds,
  computeFillPrice,
  evaluateBaselineRule,
  evaluateRiskTriggers,
  percentChange,
  roundPrice,
} from './baseline.strategy';

/** Paper fee charged on every filled order, in percent of notional. */
const PAPER_FEE_PERCENT = 0.1;
/** Equity curve resolution kept per strategy. */
const MAX_EQUITY_POINTS = 240;

@Injectable()
export class TradingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TradingService.name);

  private readonly strategies = new Map<string, TradingStrategy>();
  private readonly positions = new Map<string, TradingPosition>();
  private readonly cash = new Map<string, number>();
  private readonly lastExecutionAt = new Map<string, string>();
  private readonly ordersToday = new Map<
    string,
    { day: string; count: number }
  >();
  private readonly equityCurve = new Map<string, EquityPoint[]>();
  private readonly peakEquity = new Map<string, number>();
  private readonly maxDrawdown = new Map<string, number>();
  private readonly closedTrades = new Map<string, number[]>();
  private readonly signals: TradingSignal[] = [];
  private readonly orders: TradingOrder[] = [];
  private readonly auditEvents: TradingAuditEvent[] = [];

  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly marketData: MarketDataService,
    private readonly tradingFeature: TradingFeatureService,
  ) {}

  onModuleInit(): void {
    this.seedDefaultStrategy();
    this.unsubscribe = this.marketData.registerListener((quotes) =>
      this.onQuotes(quotes),
    );
    this.marketData.startPolling();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  disableAutomation(): void {
    for (const strategy of this.strategies.values()) {
      if (strategy.state === 'running' || strategy.armed) {
        strategy.state = 'stopped';
        strategy.armed = false;
        strategy.stoppedAt = new Date().toISOString();
        strategy.updatedAt = strategy.stoppedAt;
        this.record(
          strategy.id,
          'STRATEGY_STOPPED',
          'SUCCESS',
          'Trading feature disabled by the King administrator; automation stopped and approval revoked.',
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Strategy configuration
  // ---------------------------------------------------------------------

  listStrategies(): TradingStrategy[] {
    return Array.from(this.strategies.values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  getStrategy(id: string): TradingStrategy {
    const strategy = this.strategies.get(id);
    if (!strategy)
      throw new NotFoundException(`Trading strategy not found: ${id}`);
    return strategy;
  }

  createStrategy(input: CreateStrategyInput): TradingStrategy {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Strategy payload must be an object.');
    }
    if (this.strategies.size >= TRADING_LIMITS.maxStrategies) {
      throw new ConflictException(
        `At most ${TRADING_LIMITS.maxStrategies} strategies can be configured.`,
      );
    }
    const symbol = this.requiredSymbol(input.symbol);
    if (
      Array.from(this.strategies.values()).some(
        (item) => item.symbol === symbol,
      )
    ) {
      throw new ConflictException(`A strategy for ${symbol} already exists.`);
    }

    const timestamp = new Date().toISOString();
    const executionMode = this.optionalExecutionMode(input.executionMode);
    const strategy: TradingStrategy = {
      id: randomUUID(),
      name:
        this.optionalName(input.name) ??
        `Baseline ${this.numberOr(input.baseline, DEFAULT_BASELINE_PRICE)} on ${symbol}`,
      symbol,
      baseline: this.requiredPrice(
        input.baseline ?? DEFAULT_BASELINE_PRICE,
        'baseline',
      ),
      bandPercent: this.boundedNumber(
        input.bandPercent ?? TRADING_DEFAULTS.bandPercent,
        'bandPercent',
        0,
        TRADING_LIMITS.maxBandPercent,
      ),
      orderQuantity: this.boundedNumber(
        input.orderQuantity ?? TRADING_DEFAULTS.orderQuantity,
        'orderQuantity',
        0.000001,
        TRADING_LIMITS.maxOrderQuantity,
      ),
      startingCash: this.boundedNumber(
        input.startingCash ?? TRADING_DEFAULTS.startingCash,
        'startingCash',
        0,
        1_000_000_000,
      ),
      sellBehaviour: this.optionalSellBehaviour(input.sellBehaviour),
      executionMode,
      requireApproval: input.requireApproval !== false,
      armed: false,
      state: 'idle',
      risk: this.buildRisk(input.risk),
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      stoppedAt: null,
    };

    this.requireBrokerForLiveMode(strategy);
    this.strategies.set(strategy.id, strategy);
    this.cash.set(strategy.id, strategy.startingCash);
    this.marketData.addSymbol(symbol);
    this.record(
      strategy.id,
      'STRATEGY_CREATED',
      'SUCCESS',
      `Baseline ${strategy.baseline} on ${symbol}.`,
    );
    this.recordEquity(strategy, this.markPrice(strategy));
    return strategy;
  }

  updateStrategy(id: string, changes: UpdateStrategyInput): TradingStrategy {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new BadRequestException('Strategy update must be an object.');
    }
    const strategy = structuredClone(this.getStrategy(id));
    const allowed = new Set([
      'name',
      'symbol',
      'baseline',
      'bandPercent',
      'orderQuantity',
      'startingCash',
      'sellBehaviour',
      'executionMode',
      'requireApproval',
      'risk',
      'armed',
    ]);
    const unknown = Object.keys(changes).filter((field) => !allowed.has(field));
    if (unknown.length) {
      throw new BadRequestException(
        `Unsupported strategy fields: ${unknown.join(', ')}`,
      );
    }
    if (
      this.positions.has(id) &&
      (changes.symbol !== undefined || changes.startingCash !== undefined)
    ) {
      throw new ConflictException(
        'Close the open position before changing the instrument or capital.',
      );
    }

    if (changes.name !== undefined)
      strategy.name = this.optionalName(changes.name) ?? strategy.name;
    if (changes.symbol !== undefined) {
      const symbol = this.requiredSymbol(changes.symbol);
      if (
        symbol !== strategy.symbol &&
        Array.from(this.strategies.values()).some(
          (item) => item.id !== id && item.symbol === symbol,
        )
      ) {
        throw new ConflictException(`A strategy for ${symbol} already exists.`);
      }
      strategy.symbol = symbol;
      this.marketData.addSymbol(symbol);
    }
    if (changes.baseline !== undefined)
      strategy.baseline = this.requiredPrice(changes.baseline, 'baseline');
    if (changes.bandPercent !== undefined) {
      strategy.bandPercent = this.boundedNumber(
        changes.bandPercent,
        'bandPercent',
        0,
        TRADING_LIMITS.maxBandPercent,
      );
    }
    if (changes.orderQuantity !== undefined) {
      strategy.orderQuantity = this.boundedNumber(
        changes.orderQuantity,
        'orderQuantity',
        0.000001,
        TRADING_LIMITS.maxOrderQuantity,
      );
    }
    if (changes.startingCash !== undefined) {
      strategy.startingCash = this.boundedNumber(
        changes.startingCash,
        'startingCash',
        0,
        1_000_000_000,
      );
      this.cash.set(id, strategy.startingCash);
      this.equityCurve.set(id, []);
    }
    if (changes.sellBehaviour !== undefined)
      strategy.sellBehaviour = this.optionalSellBehaviour(
        changes.sellBehaviour,
      );
    if (changes.executionMode !== undefined)
      strategy.executionMode = this.optionalExecutionMode(
        changes.executionMode,
      );
    if (changes.requireApproval !== undefined)
      strategy.requireApproval = changes.requireApproval !== false;
    if (changes.risk !== undefined)
      strategy.risk = this.mergeRisk(strategy.risk, changes.risk);
    if (changes.armed !== undefined) strategy.armed = Boolean(changes.armed);

    this.requireBrokerForLiveMode(strategy);
    if (strategy.requireApproval && !strategy.armed) strategy.armed = false;
    strategy.updatedAt = new Date().toISOString();
    this.strategies.set(id, strategy);
    this.record(
      id,
      'STRATEGY_UPDATED',
      'SUCCESS',
      `Fields: ${Object.keys(changes).join(', ')}.`,
    );
    return strategy;
  }

  removeStrategy(id: string): { success: true } {
    const strategy = this.getStrategy(id);
    this.strategies.delete(id);
    this.positions.delete(id);
    this.cash.delete(id);
    this.lastExecutionAt.delete(id);
    this.ordersToday.delete(id);
    this.equityCurve.delete(id);
    this.peakEquity.delete(id);
    this.maxDrawdown.delete(id);
    this.closedTrades.delete(id);
    this.record(id, 'STRATEGY_DELETED', 'SUCCESS', `Removed ${strategy.name}.`);
    return { success: true };
  }

  // ---------------------------------------------------------------------
  // Run state and the operator approval gate
  // ---------------------------------------------------------------------

  startStrategy(id: string): TradingStrategy {
    const strategy = structuredClone(this.getStrategy(id));
    if (strategy.state === 'running') {
      throw new ConflictException('This strategy is already running.');
    }
    this.requireBrokerForLiveMode(strategy);
    const timestamp = new Date().toISOString();
    strategy.state = 'running';
    strategy.startedAt = timestamp;
    strategy.stoppedAt = null;
    strategy.updatedAt = timestamp;
    this.strategies.set(id, strategy);
    this.marketData.addSymbol(strategy.symbol);
    this.marketData.startPolling();
    this.record(
      id,
      'STRATEGY_STARTED',
      'SUCCESS',
      strategy.armed
        ? 'Automation is live.'
        : 'Running, but no order will be placed until the operator approves it.',
    );
    return strategy;
  }

  pauseStrategy(id: string): TradingStrategy {
    const strategy = structuredClone(this.getStrategy(id));
    if (strategy.state !== 'running') {
      throw new ConflictException('Only a running strategy can be paused.');
    }
    const timestamp = new Date().toISOString();
    strategy.state = 'paused';
    strategy.updatedAt = timestamp;
    this.strategies.set(id, strategy);
    this.record(
      id,
      'STRATEGY_PAUSED',
      'SUCCESS',
      'Rule evaluation suspended; the position is kept.',
    );
    return strategy;
  }

  stopStrategy(id: string): TradingStrategy {
    const strategy = structuredClone(this.getStrategy(id));
    if (strategy.state === 'idle' || strategy.state === 'stopped') {
      throw new ConflictException('This strategy is not running.');
    }
    const timestamp = new Date().toISOString();
    strategy.state = 'stopped';
    strategy.stoppedAt = timestamp;
    strategy.updatedAt = timestamp;
    strategy.armed = false;
    this.strategies.set(id, strategy);
    this.record(
      id,
      'STRATEGY_STOPPED',
      'SUCCESS',
      'Automation stopped and approval revoked.',
    );
    return strategy;
  }

  /** Operator approval. A running strategy trades only while it is armed. */
  setArmed(id: string, armed: boolean): TradingStrategy {
    const strategy = structuredClone(this.getStrategy(id));
    strategy.armed = Boolean(armed);
    strategy.updatedAt = new Date().toISOString();
    this.strategies.set(id, strategy);
    this.record(
      id,
      armed ? 'STRATEGY_APPROVED' : 'STRATEGY_APPROVAL_REVOKED',
      'SUCCESS',
      armed
        ? 'Operator approved automated execution.'
        : 'Operator revoked automated execution; signals will be journalled only.',
    );
    return strategy;
  }

  /**
   * Sets the baseline to the latest observed price.
   *
   * This is how an operator starts a rule from the current market instead of a
   * historical level, so the first crossing is meaningful.
   */
  adoptCurrentPriceAsBaseline(id: string): TradingStrategy {
    const strategy = this.getStrategy(id);
    const quote = this.marketData.quote(strategy.symbol);
    if (!quote) {
      throw new ConflictException(
        `No price is available for ${strategy.symbol} yet.`,
      );
    }
    const updated = this.updateStrategy(id, {
      baseline: roundPrice(quote.price),
    });
    this.record(
      id,
      'BASELINE_ADOPTED',
      'SUCCESS',
      `Baseline set to the latest ${strategy.symbol} price ${quote.price}.`,
    );
    return updated;
  }

  /** Refreshes market data and evaluates every running strategy once. */
  async runTick(): Promise<StrategyTick[]> {
    if (!this.tradingFeature.isEnabled()) {
      throw new ServiceUnavailableException(
        'Trading is currently disabled by the King administrator.',
      );
    }
    await this.marketData.refresh();
    return this.evaluateRunningStrategies();
  }

  // ---------------------------------------------------------------------
  // Rule evaluation
  // ---------------------------------------------------------------------

  private async onQuotes(quotes: readonly MarketQuote[]): Promise<void> {
    void quotes;
    if (!this.tradingFeature.isEnabled()) return;
    this.evaluateRunningStrategies();
  }

  private evaluateRunningStrategies(): StrategyTick[] {
    const ticks: StrategyTick[] = [];
    for (const strategy of this.strategies.values()) {
      if (strategy.state !== 'running') continue;
      const tick = this.evaluateStrategy(strategy);
      if (tick) ticks.push(tick);
    }
    return ticks;
  }

  private evaluateStrategy(strategy: TradingStrategy): StrategyTick | null {
    const quote = this.marketData.quote(strategy.symbol);
    if (!quote) return null;

    const now = Date.now();
    const position = this.positions.get(strategy.id) ?? null;

    // Protective exits always take priority over the baseline rule.
    const riskTrigger = evaluateRiskTriggers(
      position,
      quote.price,
      strategy.risk,
    );
    if (riskTrigger.triggered && riskTrigger.reason) {
      const signal = this.recordSignal(
        strategy,
        quote,
        riskTrigger.reason === 'stop-loss' ? 'SELL' : 'SELL',
        'risk-limit-hit',
        riskTrigger.detail,
      );
      const outcome = this.executeExit(
        strategy,
        quote,
        riskTrigger.quantity,
        riskTrigger.reason,
      );
      return {
        strategyId: strategy.id,
        signal,
        outcome,
        position: position ?? null,
      };
    }

    const decision = evaluateBaselineRule(
      { baseline: strategy.baseline, bandPercent: strategy.bandPercent },
      {
        price: quote.price,
        lastExecutionAt: this.lastExecutionAt.get(strategy.id) ?? null,
        cooldownMs: strategy.risk.cooldownMs,
        now,
      },
    );

    if (decision.action === 'HOLD') {
      return { strategyId: strategy.id, signal: null, outcome: null, position };
    }

    const filter = applyPositionFilter(
      decision.action,
      position,
      strategy.sellBehaviour,
    );
    if (!filter.permitted) {
      const signal = this.recordSignal(
        strategy,
        quote,
        decision.action,
        decision.action === 'BUY' ? 'position-already-open' : 'position-flat',
        filter.detail,
      );
      return {
        strategyId: strategy.id,
        signal,
        outcome: { executed: false, detail: filter.detail, order: null },
        position,
      };
    }

    if (strategy.requireApproval && !strategy.armed) {
      const signal = this.recordSignal(
        strategy,
        quote,
        decision.action,
        decision.reason,
        decision.explanation,
      );
      const detail =
        'Operator approval is pending; the signal was journalled but not executed.';
      this.record(strategy.id, 'SIGNAL_PENDING_APPROVAL', 'SKIPPED', detail);
      return {
        strategyId: strategy.id,
        signal,
        outcome: { executed: false, detail, order: null },
        position,
      };
    }

    const signal = this.recordSignal(
      strategy,
      quote,
      decision.action,
      decision.reason,
      decision.explanation,
    );
    const outcome = this.executeAction(strategy, quote, decision.action);
    signal.executed = outcome.executed;
    return {
      strategyId: strategy.id,
      signal,
      outcome,
      position: this.positions.get(strategy.id) ?? null,
    };
  }

  /** Evaluates one strategy immediately, regardless of its run state. */
  evaluateOnce(id: string): StrategyTick | null {
    const strategy = this.getStrategy(id);
    return this.evaluateStrategy(strategy);
  }

  // ---------------------------------------------------------------------
  // Order execution (paper accounting)
  // ---------------------------------------------------------------------

  private executeAction(
    strategy: TradingStrategy,
    quote: MarketQuote,
    action: SignalAction,
  ): ExecutionOutcome {
    const side = actionToOrderSide(action);
    if (!side)
      return {
        executed: false,
        detail: 'No order side for this action.',
        order: null,
      };
    if (!this.consumeOrderBudget(strategy)) {
      const detail = `Daily order cap of ${strategy.risk.maxOrdersPerDay} reached.`;
      this.record(strategy.id, 'ORDER_REJECTED', 'BLOCKED', detail);
      return { executed: false, detail, order: null };
    }
    const position = this.positions.get(strategy.id) ?? null;
    return side === 'buy'
      ? this.executeBuy(strategy, quote, position)
      : this.executeSell(strategy, quote, position);
  }

  private executeBuy(
    strategy: TradingStrategy,
    quote: MarketQuote,
    position: TradingPosition | null,
  ): ExecutionOutcome {
    // A buy while short covers the short instead of flipping exposure.
    if (position && position.side === 'short') {
      return this.closePosition(
        strategy,
        quote,
        position,
        position.quantity,
        'cover-short',
      );
    }
    const headroom = strategy.risk.maxPosition - (position?.quantity ?? 0);
    if (headroom <= 0) {
      const detail = `Position limit of ${strategy.risk.maxPosition} units is already reached.`;
      this.record(strategy.id, 'ORDER_REJECTED', 'BLOCKED', detail);
      return { executed: false, detail, order: null };
    }
    const affordable = this.affordableQuantity(strategy, quote, position);
    const quantity = Math.min(strategy.orderQuantity, headroom, affordable);
    if (quantity <= 0) {
      const detail = 'Paper cash is insufficient for this order quantity.';
      this.record(strategy.id, 'ORDER_REJECTED', 'BLOCKED', detail);
      return { executed: false, detail, order: null };
    }
    const fillPrice = computeFillPrice(
      'buy',
      quote,
      strategy.risk.slippagePercent,
    );
    const fee = this.fee(fillPrice, quantity);
    const existing = position;
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    const nextAverage =
      existing && existing.quantity > 0
        ? (existing.averageEntryPrice * existing.quantity +
            fillPrice * quantity) /
          nextQuantity
        : fillPrice;

    this.cash.set(
      strategy.id,
      this.cashFor(strategy.id) - fillPrice * quantity - fee,
    );
    this.positions.set(strategy.id, {
      strategyId: strategy.id,
      symbol: strategy.symbol,
      side: 'long',
      quantity: roundPrice(nextQuantity),
      averageEntryPrice: roundPrice(nextAverage),
      markPrice: quote.price,
      unrealizedPnl: roundPrice((quote.price - nextAverage) * nextQuantity),
      realizedPnl: existing?.realizedPnl ?? 0,
      openedAt: existing?.openedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const order = this.settle(strategy, quote, {
      side: 'buy',
      quantity,
      fillPrice,
      fee,
      realizedPnl: 0,
      reason: existing ? 'add-to-long' : 'open-long',
    });
    return {
      executed: true,
      detail: `Bought ${quantity} ${strategy.symbol} at ${fillPrice}.`,
      order,
    };
  }

  private executeSell(
    strategy: TradingStrategy,
    quote: MarketQuote,
    position: TradingPosition | null,
  ): ExecutionOutcome {
    if (position && position.side === 'long') {
      return this.closePosition(
        strategy,
        quote,
        position,
        position.quantity,
        'close-long',
      );
    }
    const headroom = strategy.risk.maxPosition - (position?.quantity ?? 0);
    if (headroom <= 0) {
      const detail = `Position limit of ${strategy.risk.maxPosition} units is already reached.`;
      this.record(strategy.id, 'ORDER_REJECTED', 'BLOCKED', detail);
      return { executed: false, detail, order: null };
    }
    const quantity = Math.min(strategy.orderQuantity, headroom);
    const fillPrice = computeFillPrice(
      'sell',
      quote,
      strategy.risk.slippagePercent,
    );
    const fee = this.fee(fillPrice, quantity);
    const existing = position;
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    const nextAverage =
      existing && existing.quantity > 0
        ? (existing.averageEntryPrice * existing.quantity +
            fillPrice * quantity) /
          nextQuantity
        : fillPrice;

    this.cash.set(
      strategy.id,
      this.cashFor(strategy.id) + fillPrice * quantity - fee,
    );
    this.positions.set(strategy.id, {
      strategyId: strategy.id,
      symbol: strategy.symbol,
      side: 'short',
      quantity: roundPrice(nextQuantity),
      averageEntryPrice: roundPrice(nextAverage),
      markPrice: quote.price,
      unrealizedPnl: roundPrice((nextAverage - quote.price) * nextQuantity),
      realizedPnl: existing?.realizedPnl ?? 0,
      openedAt: existing?.openedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const order = this.settle(strategy, quote, {
      side: 'sell',
      quantity,
      fillPrice,
      fee,
      realizedPnl: 0,
      reason: existing ? 'add-to-short' : 'open-short',
    });
    return {
      executed: true,
      detail: `Sold ${quantity} ${strategy.symbol} at ${fillPrice}.`,
      order,
    };
  }

  /** Closes the whole open position at the prevailing price. */
  private closePosition(
    strategy: TradingStrategy,
    quote: MarketQuote,
    position: TradingPosition,
    quantity: number,
    reason: string,
  ): ExecutionOutcome {
    const side: 'buy' | 'sell' = position.side === 'long' ? 'sell' : 'buy';
    const fillPrice = computeFillPrice(
      side,
      quote,
      strategy.risk.slippagePercent,
    );
    const fee = this.fee(fillPrice, quantity);
    const gross =
      position.side === 'long'
        ? (fillPrice - position.averageEntryPrice) * quantity
        : (position.averageEntryPrice - fillPrice) * quantity;
    const realizedPnl = roundPrice(gross - fee);
    const cashDelta =
      position.side === 'long'
        ? fillPrice * quantity - fee
        : -(fillPrice * quantity) - fee;

    this.cash.set(strategy.id, this.cashFor(strategy.id) + cashDelta);
    this.positions.delete(strategy.id);
    const trades = this.closedTrades.get(strategy.id) ?? [];
    trades.push(realizedPnl);
    this.closedTrades.set(strategy.id, trades);

    const order = this.settle(strategy, quote, {
      side,
      quantity,
      fillPrice,
      fee,
      realizedPnl,
      reason,
    });
    this.record(
      strategy.id,
      'POSITION_CLOSED',
      'SUCCESS',
      `${reason} at ${fillPrice}; realised P&L ${realizedPnl}.`,
    );
    return {
      executed: true,
      detail: `Closed ${quantity} ${strategy.symbol} at ${fillPrice}; realised P&L ${realizedPnl}.`,
      order,
    };
  }

  /** Protective exit used by the stop-loss and take-profit triggers. */
  private executeExit(
    strategy: TradingStrategy,
    quote: MarketQuote,
    quantity: number,
    reason: string,
  ): ExecutionOutcome {
    const position = this.positions.get(strategy.id);
    if (!position || position.quantity <= 0) {
      return {
        executed: false,
        detail: 'No open position to exit.',
        order: null,
      };
    }
    return this.closePosition(
      strategy,
      quote,
      position,
      Math.min(quantity, position.quantity),
      reason,
    );
  }

  private settle(
    strategy: TradingStrategy,
    quote: MarketQuote,
    draft: {
      side: 'buy' | 'sell';
      quantity: number;
      fillPrice: number;
      fee: number;
      realizedPnl: number;
      reason: string;
    },
  ): TradingOrder {
    const timestamp = new Date().toISOString();
    const order: TradingOrder = {
      id: randomUUID(),
      strategyId: strategy.id,
      symbol: strategy.symbol,
      side: draft.side,
      quantity: roundPrice(draft.quantity),
      status: 'filled',
      requestedPrice: quote.price,
      filledPrice: draft.fillPrice,
      slippage: roundPrice(Math.abs(draft.fillPrice - quote.price)),
      fee: roundPrice(draft.fee),
      realizedPnl: draft.realizedPnl,
      executionMode: strategy.executionMode,
      reason: draft.reason,
      createdAt: timestamp,
    };
    this.orders.push(order);
    this.trim(this.orders, TRADING_LIMITS.maxJournalEntries);
    this.lastExecutionAt.set(strategy.id, timestamp);
    this.record(
      strategy.id,
      'ORDER_FILLED',
      'SUCCESS',
      `${draft.side} ${order.quantity} ${strategy.symbol} at ${draft.fillPrice}.`,
    );
    this.recordEquity(strategy, quote.price);
    return order;
  }

  private fee(price: number, quantity: number): number {
    return (price * quantity * PAPER_FEE_PERCENT) / 100;
  }

  private cashFor(strategyId: string): number {
    return this.cash.get(strategyId) ?? 0;
  }

  /** Paper cash available for an additional long, accounting for fees. */
  private affordableQuantity(
    strategy: TradingStrategy,
    quote: MarketQuote,
    position: TradingPosition | null,
  ): number {
    const held = position?.side === 'short' ? position.quantity : 0;
    const cash = this.cashFor(strategy.id) + held * quote.price;
    const unitCost =
      quote.ask *
      (1 + strategy.risk.slippagePercent / 100 + PAPER_FEE_PERCENT / 100);
    if (!Number.isFinite(unitCost) || unitCost <= 0) return 0;
    return Math.floor(cash / unitCost);
  }

  private consumeOrderBudget(strategy: TradingStrategy): boolean {
    const day = new Date().toISOString().slice(0, 10);
    const entry = this.ordersToday.get(strategy.id);
    if (!entry || entry.day !== day) {
      this.ordersToday.set(strategy.id, { day, count: 1 });
      return true;
    }
    if (entry.count >= strategy.risk.maxOrdersPerDay) return false;
    entry.count += 1;
    return true;
  }

  // ---------------------------------------------------------------------
  // Journals, accounting and reporting
  // ---------------------------------------------------------------------

  private recordSignal(
    strategy: TradingStrategy,
    quote: MarketQuote,
    action: SignalAction,
    reason: SignalReason,
    explanation: string,
  ): TradingSignal {
    const { lowerBound, upperBound } = computeBounds({
      baseline: strategy.baseline,
      bandPercent: strategy.bandPercent,
    });
    const signal: TradingSignal = {
      id: randomUUID(),
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: strategy.symbol,
      action,
      reason,
      price: quote.price,
      baseline: strategy.baseline,
      lowerBound,
      upperBound,
      explanation,
      executed: false,
      createdAt: new Date().toISOString(),
    };
    this.signals.push(signal);
    this.trim(this.signals, TRADING_LIMITS.maxJournalEntries);
    this.record(strategy.id, `SIGNAL_${action}`, 'GENERATED', explanation);
    return signal;
  }

  private record(
    strategyId: string,
    action: string,
    result: string,
    detail: string,
  ): void {
    this.auditEvents.push({
      id: randomUUID(),
      strategyId,
      action,
      result,
      detail,
      createdAt: new Date().toISOString(),
    });
    this.trim(this.auditEvents, TRADING_LIMITS.maxAuditEntries);
  }

  /** Equity = paper cash plus the signed mark value of the open position. */
  private recordEquity(strategy: TradingStrategy, mark: number): void {
    const position = this.positions.get(strategy.id) ?? null;
    const cash = this.cashFor(strategy.id);
    const unrealizedPnl = position
      ? roundPrice(this.unrealized(position, mark))
      : 0;
    const equity = roundPrice(
      cash + (position ? this.signedPositionValue(position, mark) : 0),
    );
    const realizedPnl = roundPrice(this.realizedTotal(strategy.id));
    const peak = Math.max(this.peakEquity.get(strategy.id) ?? equity, equity);
    this.peakEquity.set(strategy.id, peak);
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    this.maxDrawdown.set(
      strategy.id,
      Math.max(
        this.maxDrawdown.get(strategy.id) ?? 0,
        Number(drawdown.toFixed(4)),
      ),
    );

    const curve = this.equityCurve.get(strategy.id) ?? [];
    curve.push({
      equity,
      cash: roundPrice(cash),
      realizedPnl,
      unrealizedPnl,
      recordedAt: new Date().toISOString(),
    });
    if (curve.length > MAX_EQUITY_POINTS)
      curve.splice(0, curve.length - MAX_EQUITY_POINTS);
    this.equityCurve.set(strategy.id, curve);
  }

  private signedPositionValue(position: TradingPosition, mark: number): number {
    return position.side === 'long'
      ? position.quantity * mark
      : -position.quantity * mark;
  }

  private unrealized(position: TradingPosition, mark: number): number {
    return position.side === 'long'
      ? (mark - position.averageEntryPrice) * position.quantity
      : (position.averageEntryPrice - mark) * position.quantity;
  }

  private realizedTotal(strategyId: string): number {
    return (this.closedTrades.get(strategyId) ?? []).reduce(
      (sum, value) => sum + value,
      0,
    );
  }

  private markPrice(strategy: TradingStrategy): number {
    return this.marketData.quote(strategy.symbol)?.price ?? 0;
  }

  listSignals(limit = 100): TradingSignal[] {
    return this.signals.slice(-this.clampLimit(limit)).reverse();
  }

  listOrders(limit = 100): TradingOrder[] {
    return this.orders.slice(-this.clampLimit(limit)).reverse();
  }

  listPositions(): TradingPosition[] {
    return Array.from(this.positions.values()).map((position) => {
      const strategy = this.strategies.get(position.strategyId);
      const markPrice = strategy
        ? (this.marketData.quote(strategy.symbol)?.price ?? position.markPrice)
        : position.markPrice;
      return {
        ...position,
        markPrice,
        unrealizedPnl: roundPrice(this.unrealized(position, markPrice)),
        realizedPnl: roundPrice(this.realizedTotal(position.strategyId)),
      };
    });
  }

  getPerformance(strategyId: string): StrategyPerformance {
    const strategy = this.getStrategy(strategyId);
    const position = this.positions.get(strategyId) ?? null;
    const mark =
      this.marketData.quote(strategy.symbol)?.price ?? position?.markPrice ?? 0;
    const cash = this.cashFor(strategyId);
    const equity = roundPrice(
      cash + (position ? this.signedPositionValue(position, mark) : 0),
    );
    const trades = this.closedTrades.get(strategyId) ?? [];
    const wins = trades.filter((value) => value > 0).length;
    const losses = trades.filter((value) => value < 0).length;
    const strategyOrders = this.orders.filter(
      (order) => order.strategyId === strategyId,
    );

    return {
      strategyId,
      cash: roundPrice(cash),
      equity,
      realizedPnl: roundPrice(this.realizedTotal(strategyId)),
      unrealizedPnl: position ? roundPrice(this.unrealized(position, mark)) : 0,
      returnPercent: percentChange(strategy.startingCash, equity),
      totalOrders: strategyOrders.length,
      filledOrders: strategyOrders.filter((order) => order.status === 'filled')
        .length,
      rejectedOrders: strategyOrders.filter(
        (order) => order.status === 'rejected',
      ).length,
      closedTrades: trades.length,
      winningTrades: wins,
      losingTrades: losses,
      winRatePercent: trades.length
        ? Number(((wins / trades.length) * 100).toFixed(2))
        : 0,
      maxDrawdownPercent: this.maxDrawdown.get(strategyId) ?? 0,
      equityCurve: [...(this.equityCurve.get(strategyId) ?? [])],
    };
  }

  overview(): TradingOverview {
    const performances = this.listStrategies().map((strategy) =>
      this.getPerformance(strategy.id),
    );
    const day = new Date().toISOString().slice(0, 10);
    const ordersToday = Array.from(this.ordersToday.values())
      .filter((entry) => entry.day === day)
      .reduce((sum, entry) => sum + entry.count, 0);

    return {
      provider: this.marketData.status(),
      liveExecutionEnabled: this.liveExecutionEnabled(),
      strategies: this.strategies.size,
      runningStrategies: this.listStrategies().filter(
        (strategy) => strategy.state === 'running',
      ).length,
      armedStrategies: this.listStrategies().filter(
        (strategy) => strategy.armed,
      ).length,
      openPositions: this.positions.size,
      ordersToday,
      totalEquity: roundPrice(
        performances.reduce((sum, item) => sum + item.equity, 0),
      ),
      totalRealizedPnl: roundPrice(
        performances.reduce((sum, item) => sum + item.realizedPnl, 0),
      ),
      totalUnrealizedPnl: roundPrice(
        performances.reduce((sum, item) => sum + item.unrealizedPnl, 0),
      ),
    };
  }

  audit(limit = 100): TradingAuditEvent[] {
    return this.auditEvents.slice(-this.clampLimit(limit)).reverse();
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private seedDefaultStrategy(): void {
    if (this.strategies.size > 0) return;
    try {
      this.createStrategy({
        name: `Baseline ${DEFAULT_BASELINE_PRICE}`,
        symbol: TRADING_DEFAULTS.defaultSymbol,
        baseline: DEFAULT_BASELINE_PRICE,
      });
    } catch (error) {
      this.logger.warn(
        `Could not seed the default baseline strategy: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private liveExecutionEnabled(): boolean {
    return process.env.HEXAWAVE_TRADING_LIVE_ENABLED === 'true';
  }

  /**
   * Blocks live mode until a broker adapter exists.
   *
   * This keeps the automation honest: it can simulate freely, but it can never
   * imply that real money moved when no broker is connected.
   */
  private requireBrokerForLiveMode(strategy: TradingStrategy): void {
    if (strategy.executionMode !== 'live') return;
    throw new ServiceUnavailableException(
      'Live execution is disabled: no broker adapter is configured. ' +
        'Set HEXAWAVE_TRADING_LIVE_ENABLED=true only after wiring a broker.',
    );
  }

  private requiredSymbol(value: unknown): string {
    const symbol = normalizeSymbol(value);
    if (!symbol)
      throw new BadRequestException(
        'symbol must be 2-24 letters or digits, for example BTCUSDT.',
      );
    if (symbol.length > TRADING_LIMITS.maxSymbolLength) {
      throw new BadRequestException(
        `symbol exceeds ${TRADING_LIMITS.maxSymbolLength} characters.`,
      );
    }
    return symbol;
  }

  private requiredPrice(value: unknown, field: string): number {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
      throw new BadRequestException(`${field} must be a number.`);
    }
    if (
      parsed < TRADING_LIMITS.minBaselinePrice ||
      parsed > TRADING_LIMITS.maxBaselinePrice
    ) {
      throw new BadRequestException(
        `${field} must be between ${TRADING_LIMITS.minBaselinePrice} and ${TRADING_LIMITS.maxBaselinePrice}.`,
      );
    }
    return roundPrice(parsed);
  }

  private boundedNumber(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ): number {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
      throw new BadRequestException(`${field} must be a number.`);
    }
    if (parsed < min || parsed > max) {
      throw new BadRequestException(
        `${field} must be between ${min} and ${max}.`,
      );
    }
    return parsed;
  }

  private numberOr(value: unknown, fallback: number): number {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed)
      ? parsed
      : fallback;
  }

  private optionalName(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string')
      throw new BadRequestException('name must be text.');
    const name = value.trim();
    if (!name) return undefined;
    if (name.length > TRADING_LIMITS.maxNameLength) {
      throw new BadRequestException(
        `name exceeds ${TRADING_LIMITS.maxNameLength} characters.`,
      );
    }
    return name;
  }

  private optionalSellBehaviour(
    value: unknown,
  ): TradingStrategy['sellBehaviour'] {
    if (value === undefined || value === null) return 'close-only';
    if (
      typeof value !== 'string' ||
      !(SELL_BEHAVIOURS as readonly string[]).includes(value)
    ) {
      throw new BadRequestException(
        'sellBehaviour must be close-only or open-short.',
      );
    }
    return value as TradingStrategy['sellBehaviour'];
  }

  private optionalExecutionMode(
    value: unknown,
  ): TradingStrategy['executionMode'] {
    if (value === undefined || value === null) return 'paper';
    if (
      typeof value !== 'string' ||
      !(EXECUTION_MODES as readonly string[]).includes(value)
    ) {
      throw new BadRequestException('executionMode must be paper or live.');
    }
    return value as TradingStrategy['executionMode'];
  }

  private buildRisk(overrides?: Partial<StrategyRisk>): StrategyRisk {
    return this.mergeRisk(
      {
        maxPosition: TRADING_DEFAULTS.maxPosition,
        cooldownMs: TRADING_DEFAULTS.cooldownMs,
        maxOrdersPerDay: TRADING_DEFAULTS.maxOrdersPerDay,
        stopLossPercent: TRADING_DEFAULTS.stopLossPercent,
        takeProfitPercent: TRADING_DEFAULTS.takeProfitPercent,
        slippagePercent: TRADING_DEFAULTS.slippagePercent,
      },
      overrides,
    );
  }

  private mergeRisk(
    base: StrategyRisk,
    overrides?: Partial<StrategyRisk>,
  ): StrategyRisk {
    if (overrides === undefined || overrides === null) return { ...base };
    if (typeof overrides !== 'object' || Array.isArray(overrides)) {
      throw new BadRequestException('risk must be an object.');
    }
    const allowed = new Set(Object.keys(base));
    const unknown = Object.keys(overrides).filter(
      (field) => !allowed.has(field),
    );
    if (unknown.length) {
      throw new BadRequestException(
        `Unsupported risk fields: ${unknown.join(', ')}`,
      );
    }
    return {
      maxPosition: this.boundedNumber(
        overrides.maxPosition ?? base.maxPosition,
        'risk.maxPosition',
        0.000001,
        TRADING_LIMITS.maxPositionSize,
      ),
      cooldownMs: this.boundedNumber(
        overrides.cooldownMs ?? base.cooldownMs,
        'risk.cooldownMs',
        0,
        TRADING_LIMITS.maxCooldownMs,
      ),
      maxOrdersPerDay: this.boundedNumber(
        overrides.maxOrdersPerDay ?? base.maxOrdersPerDay,
        'risk.maxOrdersPerDay',
        1,
        TRADING_LIMITS.maxOrdersPerDay,
      ),
      stopLossPercent: this.boundedNumber(
        overrides.stopLossPercent ?? base.stopLossPercent,
        'risk.stopLossPercent',
        0,
        90,
      ),
      takeProfitPercent: this.boundedNumber(
        overrides.takeProfitPercent ?? base.takeProfitPercent,
        'risk.takeProfitPercent',
        0,
        1000,
      ),
      slippagePercent: this.boundedNumber(
        overrides.slippagePercent ?? base.slippagePercent,
        'risk.slippagePercent',
        0,
        10,
      ),
    };
  }

  private clampLimit(limit: number): number {
    if (!Number.isFinite(limit)) return 100;
    return Math.max(
      1,
      Math.min(Math.floor(limit), TRADING_LIMITS.maxAuditEntries),
    );
  }

  private trim<T>(list: T[], max: number): void {
    if (list.length > max) list.splice(0, list.length - max);
  }
}
