/**
 * Market data providers for the trading automation module.
 *
 * Two providers ship with HexaWave:
 *  - `binance`   live public prices, no API key and no account required
 *  - `simulator` a deterministic mean-reverting random walk for offline use
 */
import { BINANCE_TICKER_URL, DEFAULT_BASELINE_PRICE } from "./trading.constants";
import type { MarketQuote } from "./trading.types";

export interface MarketDataProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when the provider cannot serve prices until credentials are added. */
  readonly requiresCredentials: boolean;
  /** True when quotes come from a real venue rather than a simulation. */
  readonly liveData: boolean;
  fetchQuotes(symbols: readonly string[], signal: AbortSignal): Promise<MarketQuote[]>;
}

const SYMBOL_PATTERN = /^[A-Z0-9]{2,24}$/;
const SIMULATED_SPREAD_PERCENT = 0.04;

/** Normalises and validates an instrument symbol. Returns undefined when unusable. */
export function normalizeSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const symbol = value.trim().toUpperCase().replace(/[-/\s_]/g, "");
  return SYMBOL_PATTERN.test(symbol) ? symbol : undefined;
}

function round(value: number): number {
  return Number(value.toFixed(8));
}

function quoteFrom(
  symbol: string,
  price: number,
  source: string,
  spreadPercent: number,
  observedAt: Date,
): MarketQuote {
  const halfSpread = Math.max(0, spreadPercent) / 200;
  return {
    symbol,
    price: round(price),
    bid: round(price * (1 - halfSpread)),
    ask: round(price * (1 + halfSpread)),
    source,
    observedAt: observedAt.toISOString(),
  };
}

/** Live prices from the public Binance ticker endpoint. */
export class BinanceProvider implements MarketDataProvider {
  readonly id = "binance";
  readonly displayName = "Binance public ticker";
  readonly requiresCredentials = false;
  readonly liveData = true;

  async fetchQuotes(symbols: readonly string[], signal: AbortSignal): Promise<MarketQuote[]> {
    if (symbols.length === 0) return [];
    const params = new URLSearchParams({
      symbols: JSON.stringify(symbols.map((symbol) => symbol.toUpperCase())),
    });
    const response = await fetch(`${BINANCE_TICKER_URL}?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Binance ticker returned HTTP ${response.status}.`);
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("Binance ticker returned an unexpected payload.");
    }
    const observedAt = new Date();
    const quotes: MarketQuote[] = [];
    for (const entry of payload) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as { symbol?: unknown; price?: unknown };
      const symbol = normalizeSymbol(record.symbol);
      const price = typeof record.price === "string" ? Number(record.price) : Number.NaN;
      if (!symbol || !Number.isFinite(price) || price <= 0) continue;
      quotes.push(quoteFrom(symbol, price, this.id, SIMULATED_SPREAD_PERCENT, observedAt));
    }
    return quotes;
  }
}

interface SimulatorState {
  price: number;
  seed: number;
}

/**
 * Deterministic simulator used when no live venue is reachable.
 *
 * Prices mean-revert toward the configured start price (200 by default) with a
 * small volatility, so the baseline rule produces realistic crossings.
 */
export class SimulatorProvider implements MarketDataProvider {
  readonly id = "simulator";
  readonly displayName = "HexaWave deterministic simulator";
  readonly requiresCredentials = false;
  readonly liveData = false;

  private readonly states = new Map<string, SimulatorState>();
  private readonly startPrice: number;
  private readonly volatilityPercent: number;
  private readonly meanReversion: number;

  constructor(startPrice?: number, volatilityPercent?: number, meanReversion?: number) {
    this.startPrice = startPrice && startPrice > 0 ? startPrice : DEFAULT_BASELINE_PRICE;
    this.volatilityPercent = volatilityPercent ?? 1.2;
    this.meanReversion = meanReversion ?? 0.08;
  }

  fetchQuotes(symbols: readonly string[]): Promise<MarketQuote[]> {
    const observedAt = new Date();
    const quotes = symbols.map((symbol) => {
      const state = this.stateFor(symbol);
      this.advance(state);
      return quoteFrom(symbol, state.price, this.id, SIMULATED_SPREAD_PERCENT, observedAt);
    });
    return Promise.resolve(quotes);
  }

  private stateFor(symbol: string): SimulatorState {
    const existing = this.states.get(symbol);
    if (existing) return existing;
    const seed = hashSymbol(symbol);
    const state: SimulatorState = {
      price: round(this.startPrice * (0.94 + ((seed % 1000) / 1000) * 0.12)),
      seed,
    };
    this.states.set(symbol, state);
    return state;
  }

  private advance(state: SimulatorState): void {
    const shock = gaussian(nextRandom(state));
    const drift = this.meanReversion * (this.startPrice - state.price);
    const noise = state.price * (this.volatilityPercent / 100) * shock;
    state.price = Math.max(0.000001, round(state.price + drift + noise));
  }
}

function hashSymbol(symbol: string): number {
  let hash = 2166136261;
  for (let index = 0; index < symbol.length; index += 1) {
    hash ^= symbol.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: { seed: number }): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function gaussian(value: number): number {
  const clamped = Math.min(Math.max(value, 0.0001), 0.9999);
  // Box-Muller style approximation of a standard normal sample.
  return Math.sqrt(-2 * Math.log(clamped)) * Math.cos(2 * Math.PI * clamped);
}
