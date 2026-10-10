"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  createSoftwareRequestCheckout,
  getBillingCatalog,
  getCurrentUser,
  getKingRequests,
  verifyBillingCheckout,
  type AuthUser,
  type BillingCatalog,
  type KingSoftwareRequest,
} from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";

const languages = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#", "Kotlin", "Swift", "SQL"];

export default function SoftwareRequestsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [requests, setRequests] = useState<KingSoftwareRequest[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState(["TypeScript", "Python"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<BillingCatalog | null>(null);

  const refresh = useCallback(async () => {
    setRequests(await getKingRequests());
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getCurrentUser(), getKingRequests(), getBillingCatalog()])
      .then(([currentUser, currentRequests, catalog]) => {
        if (!active) return;
        setUser(currentUser);
        setRequests(currentRequests);
        setBilling(catalog);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load your requests.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleLanguage(language: string) {
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const details = {
        companyName:
          user?.accountType === "company"
            ? user.companyName ?? ""
            : companyName,
        productName,
        purpose,
        languages: selectedLanguages,
      };
      if (!billing?.checkoutAvailable || !billing.softwareRequest) {
        throw new Error("Paid company requests are not available right now. Please contact the administrator.");
      }
      const checkout = await createSoftwareRequestCheckout(
        details,
        crypto.randomUUID(),
      );
      const payment = await openRazorpayCheckout(
        checkout,
        `Company software request — ₹${(checkout.amountPaise / 100).toFixed(2)}`,
        { name: user?.name, email: user?.email },
      );
      const result = await verifyBillingCheckout(checkout.paymentIntentId, payment);
      if (result.status !== "paid" || !result.request) {
        throw new Error("Payment is verified, but the request has not appeared yet. Refresh your request history shortly.");
      }
      setCompanyName("");
      setProductName("");
      setPurpose("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-7">
          <div>
            <Link href="/workspace" className="inline-flex items-center gap-2 text-xs text-cyan-300">
              <ArrowLeft size={14} /> Your workspace
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Company software requests</h1>
            <p className="mt-2 text-sm text-white/45">
              Submit an idea for King&apos;s review. Code generation starts only after admin approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh().catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : "Could not refresh your requests.");
            })}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:text-white"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </header>

        {error && (
          <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={(event) => void submit(event)} className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6">
          <h2 className="font-semibold">Request software</h2>
          {billing?.softwareRequest && (
            <p className="mt-2 text-xs text-white/55">
              One-time request fee: ₹{(billing.softwareRequest.amountPaise / 100).toFixed(2)} INR. Payment is verified before it enters King&apos;s approval queue.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {user?.accountType === "company" ? (
              <input
                value={user.companyName ?? ""}
                readOnly
                aria-label="Company"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/55"
              />
            ) : (
              <input required maxLength={80} value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company" aria-label="Company" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" />
            )}
            <input required maxLength={80} value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product" aria-label="Product" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" />
          </div>
          <textarea required maxLength={500} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="What should the software do?" aria-label="Software purpose" className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" rows={4} />
          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-white/60">Requested languages</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {languages.map((language) => (
                <button
                  key={language}
                  type="button"
                  aria-pressed={selectedLanguages.includes(language)}
                  onClick={() => toggleLanguage(language)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedLanguages.includes(language)
                      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                      : "border-white/10 text-white/50"
                  }`}
                >
                  {language}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={
              busy ||
              selectedLanguages.length === 0 ||
              !billing?.checkoutAvailable ||
              !billing.softwareRequest
            }
            className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {busy
              ? "Opening secure checkout…"
              : billing?.checkoutAvailable && billing.softwareRequest
                ? `Pay ₹${(billing.softwareRequest.amountPaise / 100).toFixed(2)} and submit`
                : "Paid requests currently unavailable"}
          </button>
        </form>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Your request history</h2>
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
              <p className="rounded-xl border border-white/[0.08] p-5 text-sm text-white/45">
                No requests yet. Submitted requests are visible only to you and King.
              </p>
            ) : requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-white/[0.08] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{request.companyName} · {request.productName}</h3>
                    <p className="mt-1 text-sm text-white/45">{request.purpose}</p>
                    <p className="mt-2 text-xs text-white/35">{request.languages.join(", ")}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-cyan-100">
                    {request.status === "approved"
                      ? `${request.status} · ${request.generationStatus}`
                      : request.status}
                  </span>
                </div>
                {request.projectId && request.generationStatus === "ready" && (
                  <p className="mt-3 text-xs text-white/50">
                    King approved your request and generated its workspace. It is listed in your projects.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
