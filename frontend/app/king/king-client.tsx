"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LineChart,
  RefreshCw,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  createKingRequest,
  decideKingRequest,
  getCurrentUser,
  getKingCatalog,
  getKingRequests,
  getTradingAvailability,
  retryKingGeneration,
  setTradingAvailability,
  type AuthUser,
  type KingCatalog,
  type KingSoftwareRequest,
} from "@/lib/api";
import BillingSettings from "./billing-settings";

export default function KingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [access, setAccess] = useState<"checking" | "admin" | "denied">("checking");
  const [catalog, setCatalog] = useState<KingCatalog | null>(null);
  const [requests, setRequests] = useState<KingSoftwareRequest[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [languages, setLanguages] = useState<string[]>(["TypeScript", "Python"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tradingEnabled, setTradingEnabled] = useState(false);

  const refresh = useCallback(async () => {
    const [nextCatalog, nextRequests, availability] = await Promise.all([
      getKingCatalog(),
      getKingRequests(),
      getTradingAvailability(),
    ]);
    setCatalog(nextCatalog);
    setRequests(nextRequests);
    setTradingEnabled(availability.enabled);
  }, []);

  useEffect(() => {
    let active = true;
    async function checkKingAccess() {
      try {
        const current = await getCurrentUser();
        if (!active) return;
        if (current.role !== "admin") {
          setAccess("denied");
          router.replace("/workspace");
          return;
        }
        setUser(current);
        await refresh();
        if (active) setAccess("admin");
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not verify King access.");
        setAccess("denied");
        router.replace("/login");
      }
    }
    void checkKingAccess();
    return () => {
      active = false;
    };
  }, [refresh, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createKingRequest({ companyName, productName, purpose, languages });
      setCompanyName("");
      setProductName("");
      setPurpose("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTrading() {
    const nextEnabled = !tradingEnabled;
    if (
      nextEnabled &&
      !window.confirm(
        "Enable paper-trading controls? This exposes the trading screen to administrators. Live broker execution is not available.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await setTradingAvailability(nextEnabled);
      setTradingEnabled(result.enabled);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not change trading availability.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      await decideKingRequest(id, decision);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Decision failed.");
      try {
        await refresh();
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? refreshError.message : "Could not refresh requests.";
        setError((current) => `${current} ${detail}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setBusy(true);
    setError("");
    try {
      await retryKingGeneration(id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Code generation retry failed.");
      try {
        await refresh();
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? refreshError.message : "Could not refresh requests.";
        setError((current) => `${current} ${detail}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleLanguage(language: string) {
    setLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  }

  if (access !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070a10] px-5 text-center text-white">
        <div>
          <Shield className="mx-auto text-cyan-300" size={24} />
          <p className="mt-4 text-sm text-white/70">
            {access === "checking" ? "Verifying King administrator access…" : "King access required. Redirecting…"}
          </p>
          {error && <p className="mt-3 text-xs text-rose-200" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/[0.08] pb-7">
          <Link href="/king" className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            HexaWave
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Universal King</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/45">
            Companies get software only after your approval. The IDE mixes languages. Security is defensive: Zero Trust, RBAC, audit, and OWASP ASVS. Offensive intrusion tooling is not included.
          </p>
        </header>

        {error && (
          <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <LineChart size={16} className="text-cyan-300" />
              Trading feature
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              {tradingEnabled
                ? "Enabled for administrators. Turning it off stops active automation and revokes its approval."
                : "Disabled by default. Enable to reveal the paper-trading screen for administrators."}
              {" "}Live broker orders are not supported.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tradingEnabled && (
              <Link
                href="/trading"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.05]"
              >
                Open trading
              </Link>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleTrading()}
              aria-pressed={tradingEnabled}
              className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${
                tradingEnabled
                  ? "border border-rose-300/20 text-rose-200 hover:bg-rose-300/10"
                  : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              }`}
            >
              {tradingEnabled ? "Disable trading" : "Enable trading"}
            </button>
          </div>
        </section>

        <BillingSettings />

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {catalog?.aiLayers.map((layer) => (
            <article key={layer.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <Sparkles size={16} className="text-cyan-300" />
              <h2 className="mt-3 font-semibold">{layer.name}</h2>
              <p className="mt-2 text-sm text-white/45">{layer.summary}</p>
            </article>
          ))}
        </section>
        <section className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
          <h2 className="font-semibold">Approval and delivery gates</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Your approval starts AI code generation in the requester&apos;s private workspace. It does not run or deploy the software; deployment needs its own operator approval.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Languages in the mixed IDE</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog?.languages.map((language) => (
              <span key={language} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                {language}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield size={18} className="text-cyan-300" /> Defensive controls
          </h2>
          <p className="mt-2 text-sm text-white/40">{catalog?.excluded}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {catalog?.securityControls.map((control) => (
              <article key={control.id} className="rounded-xl border border-white/[0.07] p-4">
                <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-300/80">{control.layer}</div>
                <h3 className="mt-1 font-semibold">{control.name}</h3>
                <p className="mt-2 text-sm text-white/45">{control.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <form onSubmit={(event) => void onSubmit(event)} className="mt-10 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
          <h2 className="font-semibold">Request software for a company</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" />
            <input required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" />
          </div>
          <textarea required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="What should this software do?" className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" rows={3} />
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog?.languages.map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => toggleLanguage(language)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  languages.includes(language)
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 text-white/50"
                }`}
              >
                {language}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40">
            Selected languages form the requested stack. The AI generates a mixed-language workspace only after admin approval.
          </p>
          <button type="submit" disabled={busy} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">
            Submit for approval
          </button>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Approval queue</h2>
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-white/[0.08] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{request.companyName} · {request.productName}</h3>
                    <p className="mt-1 text-sm text-white/45">{request.purpose}</p>
                    <p className="mt-2 text-xs text-white/35">
                      {request.languages.join(", ")} · {request.status}
                      {request.status === "approved" && ` · code: ${request.generationStatus}`}
                    </p>
                    {request.generationError && (
                      <p className="mt-2 text-xs text-rose-200" role="status">
                        Generation error: {request.generationError}
                      </p>
                    )}
                    {request.projectId && request.generationStatus === "ready" && (
                      <Link
                        href={`/ai-developer?id=${encodeURIComponent(request.projectId)}`}
                        className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-white"
                      >
                        Open generated workspace
                      </Link>
                    )}
                  </div>
                  {user?.role === "admin" && request.status === "pending" && (
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => void decide(request.id, "approve")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs text-emerald-200">
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => void decide(request.id, "reject")} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200">
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  )}
                  {user?.role === "admin" && request.generationStatus === "failed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void retry(request.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100 disabled:opacity-50"
                    >
                      <RefreshCw size={13} /> Retry generation
                    </button>
                  )}
                </div>
              </article>
            ))}
            {requests.length === 0 && <p className="text-sm text-white/40">No company requests yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
