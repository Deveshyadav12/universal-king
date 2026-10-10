"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createCreditsCheckout,
  getBillingAccount,
  getBillingCatalog,
  getCurrentUser,
  verifyBillingCheckout,
  type AuthUser,
  type BillingCatalog,
} from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";

type BillingAccount = Awaited<ReturnType<typeof getBillingAccount>>;

export default function BillingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextUser, nextCatalog, nextAccount] = await Promise.all([
      getCurrentUser(),
      getBillingCatalog(),
      getBillingAccount(),
    ]);
    setUser(nextUser);
    setCatalog(nextCatalog);
    setAccount(nextAccount);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getCurrentUser(), getBillingCatalog(), getBillingAccount()])
      .then(([nextUser, nextCatalog, nextAccount]) => {
        if (!active) return;
        setUser(nextUser);
        setCatalog(nextCatalog);
        setAccount(nextAccount);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load billing.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function buyCredits(packId: string, label: string) {
    setBusy(true);
    setError("");
    try {
      const checkout = await createCreditsCheckout(packId, crypto.randomUUID());
      const response = await openRazorpayCheckout(checkout, `AI credit pack — ${label}`, {
        name: user?.name,
        email: user?.email,
      });
      const result = await verifyBillingCheckout(checkout.paymentIntentId, response);
      if (result.status !== "paid") {
        throw new Error("Payment has not been confirmed yet; credits have not been added.");
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete the credit purchase.");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/workspace" className="text-xs font-semibold text-cyan-200">← Workspace</Link>
        <h1 className="mt-5 text-3xl font-semibold">Billing and AI credits</h1>
        <p className="mt-2 text-sm text-white/50">
          Credits are added only after server-side Razorpay verification and are charged for successful AI actions.
        </p>
        {error && <p className="mt-5 rounded-xl border border-rose-400/20 p-4 text-sm text-rose-200" role="alert">{error}</p>}
        <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-xs uppercase tracking-widest text-white/45">Available balance</h2>
          <p className="mt-2 text-3xl font-semibold">{account?.credits ?? "—"} credits</p>
          {account && account.creditsPerAiAction > 0 && (
            <p className="mt-2 text-xs text-white/45">{account.creditsPerAiAction} credits per successful AI action.</p>
          )}
        </section>
        {account?.subscriptions.length ? (
          <section className="mt-6 rounded-2xl border border-white/10 p-5">
            <h2 className="font-semibold">Subscription payments</h2>
            <ul className="mt-3 space-y-2">
              {account.subscriptions.map((subscription, index) => (
                <li key={`${subscription.planId ?? "plan"}-${subscription.createdAt}-${index}`} className="text-sm text-white/60">
                  {subscription.planId ?? "Subscription"} · {subscription.interval ?? "billing cycle"} · {subscription.status}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {catalog?.checkoutAvailable && catalog.creditPacks.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Credit packs</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {catalog.creditPacks.map((pack) => (
                <article key={pack.id} className="rounded-xl border border-cyan-300/15 p-5">
                  <h3 className="font-semibold">{pack.label}</h3>
                  <p className="mt-2 text-sm text-white/55">
                    {pack.credits} credits · ₹{(pack.amountPaise / 100).toFixed(2)} INR
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void buyCredits(pack.id, pack.label)}
                    className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
                  >
                    {busy ? "Processing…" : "Buy credits"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-7 rounded-xl border border-white/10 p-5 text-sm text-white/50">
            Credit purchases are not available until King completes the billing configuration.
          </p>
        )}
      </div>
    </main>
  );
}
