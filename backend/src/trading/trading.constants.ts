/**
 * Shared constants for the HexaWave trading automation module.
 */

/** Default price level that separates BUY territory from SELL territory. */
export const DEFAULT_BASELINE_PRICE = 200;

/** Signal actions produced by the rule engine. */
export const SIGNAL_ACTIONS = ["BUY", "SELL", "HOLD"] as const;

/** Lifecycle state of a strategy. */
export const STRATEGY_STATES = ["idle", "running", "paused", "stopped"] as const;

/** Where orders are sent. Paper is the only mode enabled without a broker adapter. */
export const EXECUTION_MODES = ["paper", "live"] as const;

/** Direction of an open position. */
export const POSITION_SIDES = ["long", "short"] as const;

/** How a strategy reacts to a SELL signal while flat. */
export const SELL_BEHAVIOURS = ["close-only", "open-short"] as const;

/** Why a signal was generated. */
export const SIGNAL_REASONS = [
  "price-above-baseline",
  "price-below-baseline",
  "inside-whipsaw-band",
  "cooldown-active",
  "position-already-open",
  "position-flat",
  "risk-limit-hit",
] as const;

export const TRADING_DEFAULTS = {
  /** Band around the baseline, in percent, that suppresses whipsaw signals. */
  bandPercent: 0,
  /** Units bought or sold per signal. */
  orderQuantity: 1,
  /** Paper-trading starting cash per strategy. */
  startingCash: 100_000,
  /** Minimum time between two executed orders for one strategy. */
  cooldownMs: 15_000,
  /** How often market data is refreshed. */
  pollIntervalMs: 5_000,
  /** Maximum quote history points kept per symbol. */
  maxHistoryPoints: 400,
  /** Safety cap on orders per strategy per UTC day. */
  maxOrdersPerDay: 250,
  /** Safety cap on absolute position size. */
  maxPosition: 100,
  /** Simulated slippage applied to paper fills, in percent. */
  slippagePercent: 0.05,
  /** Stop-loss distance from entry, in percent. Zero disables the stop. */
  stopLossPercent: 2,
  /** Take-profit distance from entry, in percent. Zero disables the target. */
  takeProfitPercent: 4,
  /** Default symbol watched when the operator adds none. */
  defaultSymbol: "STOCK",
} as const;

/** Upper bounds enforced by the API layer. */
export const TRADING_LIMITS = {
  maxStrategies: 25,
  maxSymbolsPerStrategy: 8,
  maxNameLength: 80,
  maxSymbolLength: 24,
  maxBaselinePrice: 10_000_000,
  minBaselinePrice: 0.000001,
  maxBandPercent: 25,
  maxCooldownMs: 24 * 60 * 60 * 1000,
  maxOrdersPerDay: 5_000,
  maxPositionSize: 1_000_000,
  maxOrderQuantity: 1_000_000,
  maxJournalEntries: 2_000,
  maxAuditEntries: 5_000,
} as const;

/** Provider identifiers understood by the market data service. */
export const MARKET_DATA_PROVIDERS = ["auto", "binance", "simulator"] as const;

/** Public Binance endpoint used for credential-free live prices. */
export const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";
