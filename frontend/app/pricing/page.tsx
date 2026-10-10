import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PageIntro } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";
import { PricingCheckout } from "./pricing-checkout";

const plans = [
  {
    name: "Free",
    audience: "Explore the software factory.",
    features: ["Start a project", "AI planning workflow", "Project workspace", "Build and preview locally"],
    href: "/register",
    action: "Get started",
  },
  {
    name: "Pro",
    audience: "For individual builders.",
    features: ["Everything in Free", "More room to build", "Advanced AI workflows", "Priority product updates"],
    href: "/contact",
    action: "Explore Pro",
    highlighted: true,
  },
  {
    name: "Team",
    audience: "For teams building together.",
    features: ["Shared team workflows", "Project collaboration", "Team-level visibility", "Centralized workspace"],
    href: "/contact",
    action: "Talk to us",
  },
  {
    name: "Enterprise",
    audience: "For organization-wide needs.",
    features: ["Enterprise onboarding", "Architecture discussion", "Governance planning", "Custom engagement"],
    href: "/contact",
    action: "Contact sales",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <main className="px-5 pb-24 lg:px-8">
        <section className="pt-20 lg:pt-28">
          <PageIntro eyebrow="Pricing" title="Choose the way you want to build." description="Start with the workflow, then find the plan that fits how you work. Plan limits and commercial pricing can be finalized as billing is connected." />
        </section>
        <section className="mx-auto mt-14 grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className={`flex flex-col rounded-2xl border p-6 ${plan.highlighted ? "border-cyan-300/35 bg-cyan-300/[0.055]" : "border-white/[0.08] bg-white/[0.025]"}`}>
              <p className="text-xs font-semibold text-cyan-200">{plan.name}</p>
              <p className="mt-3 min-h-10 text-xs leading-5 text-white/45">{plan.audience}</p>
              <div className="my-6 border-t border-white/[0.08]" />
              <ul className="flex-1 space-y-3">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2 text-[11px] leading-5 text-white/60"><Check size={13} className="mt-0.5 shrink-0 text-cyan-300" />{feature}</li>)}
              </ul>
              <Link href={plan.href} className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-xs font-semibold text-white/80 transition hover:border-cyan-300/30 hover:bg-white/[0.03]">
                {plan.action}<ArrowRight size={13} />
              </Link>
            </article>
          ))}
        </section>
        <PricingCheckout />
      </main>
    </PublicShell>
  );
}
