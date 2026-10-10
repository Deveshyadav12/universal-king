import { Building2, Code2, Rocket, Users, Workflow } from "lucide-react";
import { FeatureCard, PageIntro } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

const audiences = [
  ["Startups", "Move from an early concept to a tangible product prototype.", Rocket],
  ["Developers", "Use AI to scaffold, inspect, and iterate on a real project.", Code2],
  ["Agencies", "Explore client concepts and create a consistent starting point.", Workflow],
  ["Businesses", "Prototype internal tools and workflow ideas with a focused build loop.", Building2],
  ["Enterprise", "Evaluate AI-assisted software workflows with architecture and governance in mind.", Users],
] as const;

export default function SolutionsPage() {
  return (
    <PublicShell>
      <main className="px-5 pb-24 lg:px-8">
        <section className="pt-20 lg:pt-28">
          <PageIntro eyebrow="Solutions" title="A better starting point for every builder." description="HexaWave brings planning, code generation, and build feedback into one workflow that adapts to the team using it." />
        </section>
        <section className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map(([title, description, icon]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}
        </section>
        <section className="mx-auto mt-16 max-w-6xl rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-8 text-center sm:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Shared foundation</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From a brief to a project you can inspect.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/45">Every use case starts with an organized workspace and an explicit build-and-test loop.</p>
        </section>
      </main>
    </PublicShell>
  );
}
