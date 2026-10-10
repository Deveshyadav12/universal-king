"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSubscriptionCheckout, getBillingCatalog, verifyBillingCheckout } from "@/lib/api";
import type { BillingCatalog } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";

const planNames = {
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
} as const;

export function PricingCheckout() {
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getBillingCatalog()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch(() => {
        if (active) setCatalog(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function subscribe(planId: "pro" | "team" | "enterprise") {
    setBusy(true);
    setMessage("");
    try {
      const checkout = await createSubscriptionCheckout(planId, crypto.randomUUID());
      const response = await openRazorpayCheckout(
        checkout,
        `${planNames[planId]} ${catalog?.plans.find((plan) => plan.id === planId)?.interval ?? "monthly"} subscription`,
      );
      const result = await verifyBillingCheckout(checkout.paymentIntentId, response);
      setMessage(
        result.status === "paid"
          ? `${planNames[planId]} subscription payment verified.`
          : "Payment is pending provider confirmation.",
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Subscription checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {catalog?.checkoutAvailable && catalog.plans.some((plan) => plan.enabled) && (
        <p className="mx-auto mt-8 max-w-7xl text-sm text-white/50">
          Recurring subscriptions are available in INR. Razorpay confirms payment server-side before the account is marked paid.
        </p>
      )}
      {message && <p className="mx-auto mt-4 max-w-7xl text-sm text-cyan-100" role="status">{message}</p>}
      {catalog?.checkoutAvailable && catalog.plans.some((plan) => plan.enabled) && (
        <p className="mx-auto mt-3 max-w-7xl text-xs text-white/45">
          Subscription checkout requires an account: <Link href="/login" className="text-cyan-200 underline">log in</Link>.
        </p>
      )}
      <div className="mx-auto mt-4 grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalog?.checkoutAvailable &&
          catalog.plans.filter((plan) => plan.enabled).map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
              <h2 className="font-semibold">{planNames[plan.id]}</h2>
              <p className="mt-2 text-sm text-white/55">
                ₹{((plan.amountPaise ?? 0) / 100).toFixed(2)} INR / {plan.interval === "monthly" ? "month" : "year"}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void subscribe(plan.id)}
                className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
              >
                {busy ? "Opening checkout…" : "Subscribe"}
              </button>
            </article>
          ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl text-center text-[10px] leading-5 text-white/30">
        Checkout appears only when King enables billing and server-side Razorpay configuration is ready.
      </p>
    </>
  );
}
