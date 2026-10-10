/**
 * The pure rule engine behind HexaWave trading automation.
 *
 * Rule (as configured by the operator):
 *   price above the baseline  -> BUY
 *   price below the baseline  -> SELL
 *   otherwise                 -> HOLD
 *
 * Nothing in this file performs I/O, so the rule can be unit tested in isolation.
 */
import type {
  PositionSide,
  SignalAction,
  SignalReason,
  SellBehaviour,
  StrategyRisk,
} from "./trading.types";

/** Config slice of a strategy that drives the baseline rule. */
export interface BaselineRuleConfig {
  /** Price level that separates BUY territory from SELL territory. */
  baseline: number;
  /** Dead band around the baseline, in percent. */
  bandPercent: number;
}

/** Market and timing inputs for one evaluation pass. */
export interface BaselineRuleContext {
  price: number;
  /** Timestamp of the last executed order, used for cooldown. */
  lastExecutionAt: string | null;
  cooldownMs: number;
  /** Current epoch milliseconds. */
  now: number;
}

/** The verdict of one rule evaluation. */
export interface BaselineDecision {
  action: SignalAction;
  reason: SignalReason;
  lowerBound: number;
  upperBound: number;
  explanation: string;
}

/** Price band derived from the baseline and the whipsaw tolerance. */
export interface BaselineBounds {
  lowerBound: number;
  upperBound: number;
}

const PRICE_DECIMALS = 8;

/** Rounds a price to a stable number of decimals for comparison and display. */
export function roundPrice(value: number): number {
  return Number(value.toFixed(PRICE_DECIMALS));
}

/** Computes the SELL threshold and the BUY threshold around the baseline. */
export function computeBounds(config: BaselineRuleConfig): BaselineBounds {
  const band = Math.max(0, config.bandPercent) / 100;
  return {
    lowerBound: roundPrice(config.baseline * (1 - band)),
    upperBound: roundPrice(config.baseline * (1 + band)),
  };
}

/**
 * Evaluates the baseline rule for one price observation.
 *
 * The whipsaw band and the cooldown both downgrade a crossing to HOLD rather
 * than changing which side of the baseline triggered the signal.
 */
export function evaluateBaselineRule(
  config: BaselineRuleConfig,
  context: BaselineRuleContext,
): BaselineDecision {
  const { lowerBound, upperBound } = computeBounds(config);
  const baseline = roundPrice(config.baseline);
  const price = roundPrice(context.price);

  let action: SignalAction = "HOLD";
  let reason: SignalReason = "inside-whipsaw-band";

  if (price > upperBound) {
    action = "BUY";
    reason = "price-above-baseline";
  } else if (price < lowerBound) {
    action = "SELL";
    reason = "price-below-baseline";
  }

  if (action !== "HOLD" && isCoolingDown(context)) {
    return {
      action: "HOLD",
      reason: "cooldown-active",
      lowerBound,
      upperBound,
      explanation:
        `Price ${price} crossed the ${action} threshold, but the cooldown of ` +
        `${context.cooldownMs}ms since the last execution has not elapsed.`,
    };
  }

  return {
    action,
    reason,
    lowerBound,
    upperBound,
    explanation: explain(action, reason, price, baseline, lowerBound, upperBound),
  };
}

function isCoolingDown(context: BaselineRuleContext): boolean {
  if (!context.lastExecutionAt || context.cooldownMs <= 0) return false;
  const lastExecution = Date.parse(context.lastExecutionAt);
  if (Number.isNaN(lastExecution)) return false;
  return context.now - lastExecution < context.cooldownMs;
}

function explain(
  action: SignalAction,
  reason: SignalReason,
  price: number,
  baseline: number,
  lowerBound: number,
  upperBound: number,
): string {
  if (action === "BUY") {
    return `Price ${price} is above the buy threshold ${upperBound} (baseline ${baseline}).`;
  }
  if (action === "SELL") {
    return `Price ${price} is below the sell threshold ${lowerBound} (baseline ${baseline}).`;
  }
  if (reason === "inside-whipsaw-band") {
    if (lowerBound === upperBound) {
      return `Price ${price} is exactly at the baseline ${baseline}; waiting for a clear crossing.`;
    }
    return `Price ${price} is inside the ${lowerBound} - ${upperBound} band around baseline ${baseline}.`;
  }
  return `No action for price ${price} against baseline ${baseline}.`;
}

/** Whether the rule wants to change exposure, given the current position. */
export interface PositionFilterResult {
  permitted: boolean;
  detail: string;
}

/**
 * Maps a rule action onto the current position.
 *
 * BUY opens or adds to a long, and also covers a short.
 * SELL closes a long, and opens a short only when the strategy allows it.
 */
export function applyPositionFilter(
  action: SignalAction,
  position: { side: PositionSide; quantity: number } | null,
  sellBehaviour: SellBehaviour,
): PositionFilterResult {
  if (action === "HOLD") {
    return { permitted: false, detail: "No rule action to apply." };
  }

  if (action === "BUY") {
    if (position && position.side === "long" && position.quantity > 0) {
      return {
        permitted: false,
        detail: "Already long on this instrument; the buy signal is skipped to avoid stacking.",
      };
    }
    return { permitted: true, detail: "Buy signal accepted." };
  }

  if (!position || position.quantity <= 0) {
    if (sellBehaviour === "open-short") {
      return { permitted: true, detail: "Sell signal opens a short position." };
    }
    return {
      permitted: false,
      detail: "Sell signal ignored because the strategy is flat and short selling is disabled.",
    };
  }

  return { permitted: true, detail: "Sell signal closes the open long position." };
}

/** A protective exit triggered by the risk envelope rather than the baseline rule. */
export interface RiskTrigger {
  triggered: boolean;
  reason: "stop-loss" | "take-profit" | null;
  detail: string;
  /** Units to exit. */
  quantity: number;
}

/**
 * Checks stop-loss and take-profit levels for the open position.
 *
 * A protective exit always overrides the baseline rule so a losing position
 * cannot be carried indefinitely.
 */
export function evaluateRiskTriggers(
  position: { side: PositionSide; quantity: number; averageEntryPrice: number } | null,
  price: number,
  risk: StrategyRisk,
): RiskTrigger {
  if (!position || position.quantity <= 0) {
    return { triggered: false, reason: null, detail: "", quantity: 0 };
  }
  const entry = position.averageEntryPrice;
  const isLong = position.side === "long";
  const pnlPercent = isLong
    ? ((price - entry) / entry) * 100
    : ((entry - price) / entry) * 100;

  if (risk.stopLossPercent > 0 && pnlPercent <= -risk.stopLossPercent) {
    return {
      triggered: true,
      reason: "stop-loss",
      detail: `Stop-loss hit at ${pnlPercent.toFixed(2)}% against entry ${entry}.`,
      quantity: position.quantity,
    };
  }
  if (risk.takeProfitPercent > 0 && pnlPercent >= risk.takeProfitPercent) {
    return {
      triggered: true,
      reason: "take-profit",
      detail: `Take-profit hit at ${pnlPercent.toFixed(2)}% against entry ${entry}.`,
      quantity: position.quantity,
    };
  }
  return { triggered: false, reason: null, detail: "", quantity: 0 };
}

/** Paper fill price: buys pay the ask plus slippage, sells receive the bid minus slippage. */
export function computeFillPrice(
  side: "buy" | "sell",
  quote: { bid: number; ask: number },
  slippagePercent: number,
): number {
  const slippage = Math.max(0, slippagePercent) / 100;
  const price = side === "buy" ? quote.ask * (1 + slippage) : quote.bid * (1 - slippage);
  return roundPrice(price);
}

/** Converts a rule action into an order side. */
export function actionToOrderSide(action: SignalAction): "buy" | "sell" | null {
  if (action === "BUY") return "buy";
  if (action === "SELL") return "sell";
  return null;
}

/** Percentage change between two equity readings. */
export function percentChange(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0) return 0;
  return Number((((to - from) / Math.abs(from)) * 100).toFixed(4));
}
