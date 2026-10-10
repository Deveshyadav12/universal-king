"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  getBillingAdminConfiguration,
  updateBillingAdminConfiguration,
  type BillingAdminConfiguration,
} from "@/lib/api";

type PlanId = "pro" | "team" | "enterprise";
type EditableConfiguration = Omit<BillingAdminConfiguration, "provider">;

const planIds: PlanId[] = ["pro", "team", "enterprise"];

function rupeesFromPaise(amount: number | null): string {
  return amount === null ? "" : (amount / 100).toFixed(2);
}

function paiseFromRupees(value: string): number | null {
  if (!value.trim()) return null;
  const rupees = Number(value);
  return Number.isFinite(rupees) && rupees > 0
    ? Math.round(rupees * 100)
    : null;
}

function toPackLines(packs: EditableConfiguration["creditPacks"]): string {
  return packs
    .map((pack) =>
      `${pack.id}|${pack.label}|${pack.credits}|${rupeesFromPaise(pack.amountPaise)}`,
    )
    .join("\n");
}

export default function BillingSettings() {
  const [configuration, setConfiguration] = useState<EditableConfiguration | null>(null);
  const [provider, setProvider] = useState<BillingAdminConfiguration["provider"] | null>(null);
  const [softwareFee, setSoftwareFee] = useState("");
  const [planPrices, setPlanPrices] = useState<Record<PlanId, string>>({
    pro: "",
    team: "",
    enterprise: "",
  });
  const [packLines, setPackLines] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void getBillingAdminConfiguration()
      .then((result) => {
        if (!active) return;
        const { provider: readiness, ...saved } = result;
        setConfiguration(saved);
        setProvider(readiness);
        setSoftwareFee(rupeesFromPaise(saved.softwareRequestAmountPaise));
        setPlanPrices({
          pro: rupeesFromPaise(saved.plans.pro.amountPaise),
          team: rupeesFromPaise(saved.plans.team.amountPaise),
          enterprise: rupeesFromPaise(saved.plans.enterprise.amountPaise),
        });
        setPackLines(toPackLines(saved.creditPacks));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load billing settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updatePlan(
    id: PlanId,
    update: Partial<EditableConfiguration["plans"][PlanId]>,
  ) {
    setConfiguration((current) =>
      current
        ? { ...current, plans: { ...current.plans, [id]: { ...current.plans[id], ...update } } }
        : current,
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const creditPacks = packLines
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [id, label, creditsText, priceText] = line.split("|").map((part) => part.trim());
          const credits = Number(creditsText);
          const amountPaise = paiseFromRupees(priceText ?? "");
          if (!id || !label || !Number.isSafeInteger(credits) || credits < 1 || amountPaise === null) {
            throw new Error("Each credit pack line must be id|label|credits|price-in-INR.");
          }
          return { id, label, credits, amountPaise };
        });
      const next: EditableConfiguration = {
        ...configuration,
        softwareRequestAmountPaise: paiseFromRupees(softwareFee),
        plans: {
          pro: { ...configuration.plans.pro, amountPaise: paiseFromRupees(planPrices.pro) },
          team: { ...configuration.plans.team, amountPaise: paiseFromRupees(planPrices.team) },
          enterprise: {
            ...configuration.plans.enterprise,
            amountPaise: paiseFromRupees(planPrices.enterprise),
          },
        },
        creditPacks,
      };
      const saved = await updateBillingAdminConfiguration(next);
      const { provider: readiness, ...updated } = saved;
      setConfiguration(updated);
      setProvider(readiness);
      setSoftwareFee(rupeesFromPaise(updated.softwareRequestAmountPaise));
      setPlanPrices({
        pro: rupeesFromPaise(updated.plans.pro.amountPaise),
        team: rupeesFromPaise(updated.plans.team.amountPaise),
        enterprise: rupeesFromPaise(updated.plans.enterprise.amountPaise),
      });
      setPackLines(toPackLines(updated.creditPacks));
      setMessage("Billing settings saved. Checkout is still controlled by the server readiness checks.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save billing settings.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white";

  return (
    <section className="mt-8 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Razorpay and billing</h2>
      <p className="mt-2 text-sm text-white/50">
        Set product pricing, recurring plan IDs, software request fees, and AI credit usage. API credentials remain server-side environment secrets.
      </p>
      {provider && (
        <p className="mt-3 text-xs text-white/60" role="status">
          Provider: {provider.mode}; credentials {provider.credentialsConfigured ? "configured" : "missing"};
          {" "}webhook secret {provider.webhookConfigured ? "configured" : "missing"};
          {provider.mode === "live" && !provider.livePaymentsEnabled
            ? " — live payments are server-disabled"
            : ""}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-rose-200" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-200" role="status">{message}</p>}
      {loading ? (
        <p className="mt-5 text-sm text-white/50">Loading saved settings…</p>
      ) : configuration ? (
        <form onSubmit={(event) => void save(event)} className="mt-5 space-y-6">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={configuration.checkoutEnabled}
              onChange={(event) =>
                setConfiguration({ ...configuration, checkoutEnabled: event.target.checked })
              }
            />
            Allow checkout when provider secrets and item settings are ready
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-white/60">
              Company software request fee (INR)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={softwareFee}
                onChange={(event) => setSoftwareFee(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-xs text-white/60">
              Credits charged per successful AI action
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                value={configuration.creditsPerAiAction}
                onChange={(event) =>
                  setConfiguration({
                    ...configuration,
                    creditsPerAiAction: Number(event.target.value),
                  })
                }
                className={fieldClass}
              />
            </label>
          </div>

          <div>
            <h3 className="font-medium">Recurring subscriptions</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {planIds.map((id) => (
                <fieldset key={id} className="rounded-xl border border-white/10 p-4">
                  <legend className="px-1 text-sm font-semibold capitalize">{id}</legend>
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={configuration.plans[id].enabled}
                      onChange={(event) => updatePlan(id, { enabled: event.target.checked })}
                    />
                    Enable this plan
                  </label>
                  <label className="mt-3 block text-xs text-white/60">
                    Recurring price (INR)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={planPrices[id]}
                      onChange={(event) =>
                        setPlanPrices({ ...planPrices, [id]: event.target.value })
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="mt-3 block text-xs text-white/60">
                    Interval
                    <select
                      value={configuration.plans[id].interval}
                      onChange={(event) =>
                        updatePlan(id, { interval: event.target.value as "monthly" | "yearly" })
                      }
                      className={fieldClass}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-xs text-white/60">
                    Razorpay plan ID
                    <input
                      value={configuration.plans[id].razorpayPlanId}
                      onChange={(event) => updatePlan(id, { razorpayPlanId: event.target.value })}
                      placeholder="plan_..."
                      className={fieldClass}
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </div>

          <label className="block text-xs text-white/60">
            AI credit packs — one per line: <code>id|label|credits|price-in-INR</code>
            <textarea
              rows={4}
              value={packLines}
              onChange={(event) => setPackLines(event.target.value)}
              placeholder={"starter|Starter|100|199.00\nbuilder|Builder|500|799.00"}
              className={fieldClass}
            />
          </label>
          <p className="text-xs leading-5 text-white/40">
            Checkout is fail-closed unless King enables it, server credentials are valid, and each item is configured. Subscription amounts are checked against the actual Razorpay plan before checkout.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save billing settings"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
