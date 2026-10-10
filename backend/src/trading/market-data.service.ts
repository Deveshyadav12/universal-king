/**
 * Polls prices for every watched instrument and keeps a rolling history.
 *
 * The provider is chosen from `HEXAWAVE_MARKET_DATA_PROVIDER`:
 *   auto      (default) try the live venue, fall back to the simulator
 *   binance   live public prices
 *   simulator offline deterministic prices
 */
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { MARKET_DATA_PROVIDERS, TRADING_DEFAULTS } from "./trading.constants";
import type { MarketProviderStatus, MarketQuote, PricePoint } from "./trading.types";
import {
  BinanceProvider,
  SimulatorProvider,
  normalizeSymbol,
  type MarketDataProvider,
} from "./market-data.providers";

type QuoteListener = (quotes: readonly MarketQuote[]) => void | Promise<void>;

const SIMULATOR_START_PRICE = Number(process.env.HEXAWAVE_SIMULATOR_START_PRICE);

function requestedProvider(): string {
  const configured = (process.env.HEXAWAVE_MARKET_DATA_PROVIDER ?? "auto").trim().toLowerCase();
  return (MARKET_DATA_PROVIDERS as readonly string[]).includes(configured) ? configured : "auto";
}

function configuredPollInterval(): number {
  const configured = Number(process.env.HEXAWAVE_MARKET_POLL_MS);
  if (!Number.isFinite(configured) || configured < 1_000) return TRADING_DEFAULTS.pollIntervalMs;
  return Math.min(configured, 600_000);
}

@Injectable()
export class MarketDataService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly providers: MarketDataProvider[];
  private readonly quotes = new Map<string, MarketQuote>();
  private readonly history = new Map<string, PricePoint[]>();
  private readonly listeners = new Set<QuoteListener>();

  private readonly providerPreference = requestedProvider();
  private readonly pollIntervalMs = configuredPollInterval();
  private readonly simulator = new SimulatorProvider(
    Number.isFinite(SIMULATOR_START_PRICE) && SIMULATOR_START_PRICE > 0 ? SIMULATOR_START_PRICE : undefined,
  );

  private activeProvider: MarketDataProvider;
  private symbols: string[] = [TRADING_DEFAULTS.defaultSymbol];
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;
  private lastTickAt: string | null = null;
  private lastError: string | null = null;
  private liveFallbackNoted = false;

  constructor() {
    this.providers = [new BinanceProvider(), this.simulator];
    this.activeProvider = this.providerPreference === "simulator"
      ? this.simulator
      : this.provider(this.providerPreference) ?? this.simulator;
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  /** Replaces the watched instrument list. Valid symbols are normalised to upper case. */
  watch(symbols: readonly string[]): string[] {
    const normalised = Array.from(
      new Set(
        symbols
          .map((symbol) => normalizeSymbol(symbol))
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    );
    this.symbols = normalised.length ? normalised : [TRADING_DEFAULTS.defaultSymbol];
    return [...this.symbols];
  }

  /** Adds one instrument to the watch list. */
  addSymbol(symbol: string): string[] {
    return this.watch([...this.symbols, symbol]);
  }

  registerListener(listener: QuoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startPolling(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.pollIntervalMs);
    this.timer.unref();
  }

  stopPolling(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  get polling(): boolean {
    return Boolean(this.timer);
  }

  quote(symbol: string): MarketQuote | undefined {
    const normalised = normalizeSymbol(symbol);
    return normalised ? this.quotes.get(normalised) : undefined;
  }

  allQuotes(): MarketQuote[] {
    return this.symbols
      .map((symbol) => this.quotes.get(symbol))
      .filter((quote): quote is MarketQuote => Boolean(quote));
  }

  priceHistory(symbol: string): PricePoint[] {
    const normalised = normalizeSymbol(symbol);
    return normalised ? [...(this.history.get(normalised) ?? [])] : [];
  }

  /** Fetches one round of quotes and notifies listeners. Never throws. */
  async refresh(): Promise<MarketQuote[]> {
    if (this.inFlight) return this.allQuotes();
    this.inFlight = true;
    try {
      const quotes = await this.fetchFromActiveProvider();
      this.applyQuotes(quotes);
      this.lastTickAt = new Date().toISOString();
      this.lastError = null;
      await this.notify(quotes);
      return quotes;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Market data refresh failed.";
      this.logger.warn(this.lastError);
      return this.allQuotes();
    } finally {
      this.inFlight = false;
    }
  }

  status(): MarketProviderStatus {
    return {
      requested: this.providerPreference,
      active: this.activeProvider.id,
      displayName: this.activeProvider.displayName,
      requiresCredentials: this.activeProvider.requiresCredentials,
      liveData: this.activeProvider.liveData,
      lastError: this.lastError,
      pollIntervalMs: this.pollIntervalMs,
      watchedSymbols: [...this.symbols],
      lastTickAt: this.lastTickAt,
    };
  }

  private async fetchFromActiveProvider(): Promise<MarketQuote[]> {
    const controller = new AbortController();
    try {
      return await this.activeProvider.fetchQuotes(this.symbols, controller.signal);
    } catch (error) {
      if (this.activeProvider.liveData && this.providerPreference === "auto") {
        this.switchToSimulator(error);
        return this.simulator.fetchQuotes(this.symbols);
      }
      throw error;
    }
  }

  private switchToSimulator(error: unknown): void {
    const detail = error instanceof Error ? error.message : "Live market data unavailable.";
    this.activeProvider = this.simulator;
    if (!this.liveFallbackNoted) {
      this.liveFallbackNoted = true;
      this.logger.warn(`Live market data unavailable (${detail}). Using the simulator.`);
    }
    this.lastError = `${detail} Fell back to the HexaWave simulator.`;
  }

  private applyQuotes(quotes: readonly MarketQuote[]): void {
    for (const quote of quotes) {
      this.quotes.set(quote.symbol, quote);
      const points = this.history.get(quote.symbol) ?? [];
      points.push({ price: quote.price, observedAt: quote.observedAt });
      if (points.length > TRADING_DEFAULTS.maxHistoryPoints) {
        points.splice(0, points.length - TRADING_DEFAULTS.maxHistoryPoints);
      }
      this.history.set(quote.symbol, points);
    }
  }

  private async notify(quotes: readonly MarketQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    for (const listener of this.listeners) {
      try {
        await listener(quotes);
      } catch (error) {
        this.logger.error(
          `Market data listener failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
  }

  private provider(id: string): MarketDataProvider | undefined {
    return this.providers.find((candidate) => candidate.id === id);
  }
}
