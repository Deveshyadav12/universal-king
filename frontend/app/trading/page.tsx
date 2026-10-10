"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import {
  armTradingStrategy,
  createTradingStrategy,
  getCurrentUser,
  getTradingOrders,
  getTradingOverview,
  getTradingPositions,
  getTradingQuotes,
  getTradingSignals,
  getTradingStrategies,
  pauseTradingStrategy,
  runTradingTick,
  startTradingStrategy,
  stopTradingStrategy,
  type AuthUser,
  type MarketQuote,
  type TradingOrder,
  type TradingOverview,
  type TradingPosition,
  type TradingSignal,
  type TradingStrategy,
} from "@/lib/api";

const BASELINE = 200;

async function loadDesk() {
  const [overview, quotes, strategies, signals, orders, positions] = await Promise.all([
    getTradingOverview(),
    getTradingQuotes(),
    getTradingStrategies(),
    getTradingSignals(),
    getTradingOrders(),
    getTradingPositions(),
  ]);
  return { overview, quotes, strategies, signals, orders, positions };
}

export default function TradingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<TradingOverview | null>(null);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [orders, setOrders] = useState<TradingOrder[]>([]);
  const [positions, setPositions] = useState<TradingPosition[]>([]);
  const [symbol, setSymbol] = useState("STOCK");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const desk = await loadDesk();
    setOverview(desk.overview);
    setQuotes(desk.quotes);
    setStrategies(desk.strategies);
    setSignals(desk.signals);
    setOrders(desk.orders);
    setPositions(desk.positions);
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((current) => {
        if (active) setUser(current);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    void refresh().catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : "Could not load trading.");
      }
    });
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const quote = quotes[0];
  const actionHint = useMemo(() => {
    if (!quote) return "Waiting for a price…";
    if (quote.price > BASELINE) return `Price ${quote.price} is above ${BASELINE} → BUY`;
    if (quote.price < BASELINE) return `Price ${quote.price} is below ${BASELINE} → SELL`;
    return `Price is exactly ${BASELINE} → HOLD`;
  }, [quote]);

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Trading action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() =>
      createTradingStrategy({
        symbol,
        baseline: BASELINE,
        name: `Baseline ${BASELINE} on ${symbol.toUpperCase()}`,
      }),
    );
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.08] pb-7">
          <div>
            <Link href="/dashboard" className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              HexaWave
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Baseline 200 automation</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/45">
              Paper trading only. Price above 200 buys, price below 200 sells. Orders stay journalled until you approve the strategy.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/king"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:text-white"
            >
              <ShieldCheck size={15} /> Universal King
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => runTradingTick())}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
            >
              <RefreshCw size={15} /> Run tick
            </button>
          </div>
        </header>

        {user && user.role !== "admin" && (
          <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100" role="status">
            Trading controls are admin-only. Sign in as an administrator to arm automation.
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Rule", value: actionHint, icon: Activity },
            {
              label: "Equity",
              value: overview ? overview.totalEquity.toLocaleString() : "—",
              icon: ArrowUpRight,
            },
            {
              label: "Armed",
              value: overview ? String(overview.armedStrategies) : "—",
              icon: ShieldCheck,
            },
            {
              label: "Provider",
              value: overview?.provider.displayName ?? "—",
              icon: Sparkles,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-white/35">
                {label}
                <Icon size={14} className="text-cyan-300" />
              </div>
              <p className="mt-3 text-sm font-semibold leading-6">{value}</p>
            </div>
          ))}
        </section>

        <form onSubmit={(event) => void onCreate(event)} className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-white/[0.08] p-5">
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"
            placeholder="Symbol"
            aria-label="Instrument symbol"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            Add baseline 200 strategy
          </button>
          <p className="w-full text-xs text-white/40">
            Simulator prices mean-revert around 200 so the rule produces real crossings without a broker.
          </p>
        </form>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="text-lg font-semibold">Strategies</h2>
            <div className="mt-4 space-y-4">
              {strategies.map((strategy) => (
                <article key={strategy.id} className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{strategy.name}</h3>
                      <p className="mt-1 text-xs text-white/40">
                        {strategy.symbol} · baseline {strategy.baseline} · {strategy.state}
                        {strategy.armed ? " · approved" : " · waiting for approval"}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase text-white/60">
                      {strategy.executionMode}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void run(() => startTradingStrategy(strategy.id))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <Play size={12} /> Start
                    </button>
                    <button type="button" disabled={busy} onClick={() => void run(() => pauseTradingStrategy(strategy.id))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <Pause size={12} /> Pause
                    </button>
                    <button type="button" disabled={busy} onClick={() => void run(() => stopTradingStrategy(strategy.id))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <Square size={12} /> Stop
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => armTradingStrategy(strategy.id, !strategy.armed))}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-200"
                    >
                      <ShieldCheck size={12} /> {strategy.armed ? "Revoke approval" : "Approve & arm"}
                    </button>
                  </div>
                </article>
              ))}
              {strategies.length === 0 && <p className="text-sm text-white/40">No strategies yet.</p>}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Open positions</h2>
            <div className="mt-4 space-y-3">
              {positions.map((position) => (
                <article key={position.strategyId} className="rounded-xl border border-white/[0.08] p-4 text-sm">
                  <div className="flex justify-between">
                    <span>{position.symbol} {position.side}</span>
                    <span>{position.quantity} @ {position.averageEntryPrice}</span>
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Unrealised {position.unrealizedPnl.toFixed(2)}
                  </p>
                </article>
              ))}
              {positions.length === 0 && <p className="text-sm text-white/40">Flat. A BUY above 200 opens the first long.</p>}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="text-lg font-semibold">Signals</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {signals.slice(0, 12).map((signal) => (
                <li key={signal.id} className="rounded-xl border border-white/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={signal.action === "BUY" ? "text-emerald-300" : "text-rose-300"}>
                      {signal.action === "BUY" ? <ArrowUpRight className="inline" size={14} /> : <ArrowDownRight className="inline" size={14} />}
                      {" "}{signal.action} {signal.symbol} @ {signal.price}
                    </span>
                    <span className="text-[10px] text-white/35">{signal.executed ? "filled" : "journalled"}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">{signal.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Orders</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {orders.slice(0, 12).map((order) => (
                <li key={order.id} className="rounded-xl border border-white/[0.07] px-4 py-3">
                  {order.side.toUpperCase()} {order.quantity} {order.symbol} · {order.status}
                  {order.filledPrice ? ` @ ${order.filledPrice}` : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
