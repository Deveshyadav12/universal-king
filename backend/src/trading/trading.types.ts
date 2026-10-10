/**
 * Domain types for the HexaWave trading automation module.
 *
 * The module automates one explicit rule, configurable per strategy:
 * when the price crosses above the baseline it buys, and when the price
 * crosses below the baseline it sells.
 */
import type {
  EXECUTION_MODES,
  POSITION_SIDES,
  SELL_BEHAVIOURS,
  SIGNAL_ACTIONS,
  SIGNAL_REASONS,
  STRATEGY_STATES,
} from "./trading.constants";

export type SignalAction = (typeof SIGNAL_ACTIONS)[number];
export type StrategyState = (typeof STRATEGY_STATES)[number];
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export type PositionSide = (typeof POSITION_SIDES)[number];
export type SellBehaviour = (typeof SELL_BEHAVIOURS)[number];
export type SignalReason = (typeof SIGNAL_REASONS)[number];

/** A single observed price for one instrument. */
export interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  source: string;
  observedAt: string;
}

/** One point of the rolling price history kept per symbol. */
export interface PricePoint {
  price: number;
  observedAt: string;
}

/** The risk envelope applied on top of the baseline rule. */
export interface StrategyRisk {
  /** Hard cap on absolute position size in units. */
  maxPosition: number;
  /** Minimum time between two executed orders, in milliseconds. */
  cooldownMs: number;
  /** Orders allowed per strategy per UTC day. */
  maxOrdersPerDay: number;
  /** Stop-loss distance from entry, in percent. Zero disables it. */
  stopLossPercent: number;
  /** Take-profit distance from entry, in percent. Zero disables it. */
  takeProfitPercent: number;
  /** Slippage applied to paper fills, in percent. */
  slippagePercent: number;
}

/** A configured baseline automation. */
export interface TradingStrategy {
  id: string;
  name: string;
  symbol: string;
  /** Price level that separates BUY (above) from SELL (below). */
  baseline: number;
  /** Dead band around the baseline, in percent, that suppresses whipsaw. */
  bandPercent: number;
  /** Units bought or sold per signal. */
  orderQuantity: number;
  /** Trading capital used for paper accounting. */
  startingCash: number;
  /** What a SELL signal does while the strategy is flat. */
  sellBehaviour: SellBehaviour;
  executionMode: ExecutionMode;
  /** Operator approval gate: a running strategy still needs arming to trade. */
  requireApproval: boolean;
  /** True once the operator approved automated execution. */
  armed: boolean;
  state: StrategyState;
  risk: StrategyRisk;
  createdAt: string;
  updatedAt: string;
  /** Set when the strategy last changed run state. */
  startedAt: string | null;
  stoppedAt: string | null;
}

/** A generated decision, whether or not it resulted in an order. */
export interface TradingSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: SignalAction;
  reason: SignalReason;
  price: number;
  baseline: number;
  /** Baseline minus the whipsaw band. */
  lowerBound: number;
  /** Baseline plus the whipsaw band. */
  upperBound: number;
  /** Human readable explanation of the decision. */
  explanation: string;
  /** True when the signal was approved and sent for execution. */
  executed: boolean;
  createdAt: string;
}

export interface TradingOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  status: "filled" | "rejected";
  requestedPrice: number;
  filledPrice: number | null;
  slippage: number;
  fee: number;
  realizedPnl: number;
  executionMode: ExecutionMode;
  reason: string;
  createdAt: string;
}

export interface TradingPosition {
  strategyId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  averageEntryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: string;
  updatedAt: string;
}

export interface EquityPoint {
  equity: number;
  cash: number;
  realizedPnl: number;
  unrealizedPnl: number;
  recordedAt: string;
}

export interface StrategyPerformance {
  strategyId: string;
  cash: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  returnPercent: number;
  totalOrders: number;
  filledOrders: number;
  rejectedOrders: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  equityCurve: EquityPoint[];
}

export interface TradingAuditEvent {
  id: string;
  strategyId: string;
  action: string;
  result: string;
  detail: string;
  createdAt: string;
}

/** Why a rule decision was or was not turned into an order. */
export interface ExecutionOutcome {
  executed: boolean;
  detail: string;
  order: TradingOrder | null;
}

/** The full result of one evaluation pass for one strategy. */
export interface StrategyTick {
  strategyId: string;
  signal: TradingSignal | null;
  outcome: ExecutionOutcome | null;
  position: TradingPosition | null;
}

export interface CreateStrategyInput {
  name?: string;
  symbol: string;
  baseline?: number;
  bandPercent?: number;
  orderQuantity?: number;
  startingCash?: number;
  sellBehaviour?: SellBehaviour;
  executionMode?: ExecutionMode;
  requireApproval?: boolean;
  risk?: Partial<StrategyRisk>;
}

export type UpdateStrategyInput = Partial<CreateStrategyInput> & {
  /** Toggle the operator approval gate without restarting the strategy. */
  armed?: boolean;
};

export interface MarketProviderStatus {
  requested: string;
  active: string;
  displayName: string;
  requiresCredentials: boolean;
  liveData: boolean;
  lastError: string | null;
  pollIntervalMs: number;
  watchedSymbols: string[];
  lastTickAt: string | null;
}

export interface TradingOverview {
  provider: MarketProviderStatus;
  liveExecutionEnabled: boolean;
  strategies: number;
  runningStrategies: number;
  armedStrategies: number;
  openPositions: number;
  ordersToday: number;
  totalEquity: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
}
