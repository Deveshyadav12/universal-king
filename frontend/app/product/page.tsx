import Link from "next/link";
import { ArrowRight, Bot, Eye, Hammer, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { FeatureCard, PageIntro, SectionHeading } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

const capabilities = [
  ["AI Developer", "An IDE-style workspace that brings files, AI chat, terminal, and preview together.", Bot],
  ["Project Factory", "Turn a natural-language brief into a structured, multi-file project.", Hammer],
  ["Build & Test", "Run generated-project checks and keep the actual build output close at hand.", Terminal],
  ["AI Fix", "Use build and runtime errors as context for a bounded repair-and-rebuild cycle.", ShieldCheck],
  ["Preview", "Start the generated app locally and inspect it from the workspace.", Eye],
  ["Deployment", "Prepare a project for its next step with deployment-oriented guidance.", Rocket],
] as const;

export default function ProductPage() {
  return (
    <PublicShell>
      <main>
        <section className="px-5 pb-16 pt-20 lg:px-8 lg:pt-28">
          <PageIntro eyebrow="Product" title="A software factory, not another blank editor." description="HexaWave connects the steps between a good idea and an application you can open, inspect, and improve." />
        </section>
        <section className="px-5 pb-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(([title, description, icon]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}
          </div>
        </section>
        <section className="border-y border-white/[0.06] bg-[#080b11] px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Inside the IDE" title="Keep the full build loop in view." description="The AI Developer workspace is designed around the real project: its files, its output, and the running preview." />
              <Link href="/ai-developer" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">Open the AI Developer <ArrowRight size={15} /></Link>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070a10] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3 text-[10px] text-white/45"><span className="h-2 w-2 rounded-full bg-cyan-300" /> project / app / page.tsx <span className="ml-auto text-emerald-300">Workspace</span></div>
              <div className="grid min-h-56 grid-cols-[120px_1fr]">
                <div className="border-r border-white/[0.07] p-3 text-[9px] leading-7 text-white/40">▾ app<br />　page.tsx<br />　layout.tsx<br />package.json<br />README.md</div>
                <pre className="overflow-hidden p-4 text-[9px] leading-5 text-cyan-100/80"><code>{`export default function Product() {
  return (
    <main>
      <ProductOverview />
      <FeatureGrid />
    </main>
  );
}`}</code></pre>
              </div>
              <div className="border-t border-white/[0.07] px-4 py-3 text-[9px] text-white/40">Terminal · build output is available in the workspace</div>
            </div>
          </div>
        </section>
        <section className="px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 sm:p-12">
            <SectionHeading eyebrow="One connected workflow" title="Move from the first prompt to a live local preview." description="Project files persist in a workspace, so generation, editing, testing, and running build on the same foundation." />
            <div className="mt-8 flex flex-wrap gap-2 text-[10px] text-white/55">
              {["Plan", "Architecture", "Code", "Test", "Build", "Repair", "Preview"].map((step, index) => <span key={step} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">{step}{index < 6 && <ArrowRight size={11} className="text-cyan-300" />}</span>)}
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
