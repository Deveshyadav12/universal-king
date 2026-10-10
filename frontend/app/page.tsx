import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Layers3,
  Play,
  Rocket,
  Sparkles,
  Terminal,
  WandSparkles,
} from "lucide-react";
import { FeatureCard, SectionHeading } from "../components/public-content";
import { PublicShell } from "../components/public-shell";

const workflow = [
  ["01", "Describe", "Share the product idea and the outcomes you want."],
  ["02", "Design", "Turn requirements into a plan and a clear architecture."],
  ["03", "Build", "Generate a real project in a persistent workspace."],
  ["04", "Verify", "Test, build, fix errors, then preview the result."],
];

const features = [
  {
    icon: Layers3,
    title: "Plan before code",
    description: "Structure the request into a project plan and implementation outline.",
  },
  {
    icon: Code2,
    title: "Generate a workspace",
    description: "Create editable project files instead of returning a one-off code snippet.",
  },
  {
    icon: Terminal,
    title: "Build and improve",
    description: "Run tests and builds, inspect the actual output, and iterate on errors.",
  },
  {
    icon: Rocket,
    title: "Preview the result",
    description: "Run your project locally and work with it in the AI Developer IDE.",
  },
];

const useCases = [
  ["Founders", "Validate an idea with a working first version."],
  ["Product teams", "Explore prototypes before committing engineering time."],
  ["Independent developers", "Move from a blank workspace to a structured project."],
];

export default function HomePage() {
  return (
    <PublicShell>
      <main>
        <section className="relative px-5 pb-24 pt-20 sm:pt-28 lg:px-8 lg:pb-32">
          <div className="pointer-events-none absolute left-1/2 top-[-190px] -z-0 h-[440px] w-[740px] -translate-x-1/2 rounded-full bg-cyan-400/[0.09] blur-[140px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-[10px] font-semibold tracking-wide text-cyan-100">
                <Sparkles size={13} />
                AI SOFTWARE FACTORY
              </div>
              <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">
                From idea to
                <span className="block bg-gradient-to-r from-cyan-100 via-cyan-300 to-blue-400 bg-clip-text pb-2 text-transparent">
                  working software.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-white/50 sm:text-base">
                HexaWave is an AI-native software factory that plans your
                application, shapes its architecture, generates project files,
                and helps you test and build them in one workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/projects/new"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:bg-cyan-100"
                >
                  Start a project
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/product"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3.5 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:text-white"
                >
                  Explore the platform
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-white/35">
                <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-cyan-300" /> Plan and architect</span>
                <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-cyan-300" /> Generate multi-file projects</span>
                <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-cyan-300" /> Build and preview</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.1] bg-[#0a0d14]/95 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 pb-3">
                <span className="h-2 w-2 rounded-full bg-red-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                <span className="ml-3 text-[10px] text-white/35">HexaWave · AI Developer</span>
                <span className="ml-auto rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[9px] text-cyan-200">Workspace</span>
              </div>
              <div className="grid min-h-[310px] grid-cols-[125px_1fr] sm:grid-cols-[155px_1fr]">
                <div className="border-r border-white/[0.06] p-3">
                  <p className="mb-3 text-[8px] font-bold uppercase tracking-[0.18em] text-white/30">Explorer</p>
                  {["app", "page.tsx", "layout.tsx", "package.json", "README.md"].map((file, index) => (
                    <div key={file} className={`mb-1 rounded px-2 py-1.5 text-[9px] ${index === 1 ? "bg-cyan-300/10 text-cyan-100" : "text-white/40"}`}>
                      {index === 0 ? "▾ " : "　"}{file}
                    </div>
                  ))}
                  <div className="mt-6 rounded-lg border border-white/[0.06] p-2">
                    <p className="text-[8px] font-semibold text-white/45">AI chat</p>
                    <p className="mt-2 text-[8px] leading-4 text-white/30">Build a simple, responsive product landing page.</p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="border-b border-white/[0.06] px-4 py-2.5 text-[9px] text-white/45">app / page.tsx</div>
                  <pre className="flex-1 overflow-hidden p-4 text-[9px] leading-5 text-cyan-100/80 sm:text-[10px]"><code>{`export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <FeatureGrid />
      <CallToAction />
    </main>
  );
}`}</code></pre>
                  <div className="border-t border-white/[0.06] p-3">
                    <div className="flex items-center gap-2 text-[9px] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Ready · build checks passed
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[8px] text-white/35">
                      <span>Describe what to build next…</span>
                      <Bot size={13} className="text-cyan-300" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] px-2 pt-3 text-[9px] text-white/35">
                <span className="inline-flex items-center gap-1.5"><Terminal size={12} /> Terminal · npm run build</span>
                <span className="inline-flex items-center gap-1.5"><Play size={11} /> Preview</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-7 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 text-center sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["One workflow", "Plan through build"],
              ["Real files", "A project you can edit"],
              ["Useful feedback", "Tests and build output"],
              ["One workspace", "Code, chat and preview"],
            ].map(([value, label]) => (
              <div key={value}>
                <p className="text-xs font-semibold text-white/75">{value}</p>
                <p className="mt-1 text-[10px] text-white/35">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="How it works"
              title="A clear path from prompt to project."
              description="Work through the software lifecycle with a connected set of AI agents and a persistent project workspace."
              align="center"
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map(([number, title, description]) => (
                <article key={number} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                  <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-300">{number}</p>
                  <h3 className="mt-5 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/[0.06] bg-[#080b11] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="The factory"
              title="More than code generation."
              description="A connected development flow that keeps planning, project files, verification, and preview in context."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
            </div>
            <Link href="/platform" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white">
              Meet the AI agents <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section className="px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Who it is for"
              title="A faster start for every kind of builder."
              description="Use HexaWave to explore an idea, shape a product direction, or accelerate an early implementation."
              align="center"
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {useCases.map(([title, description]) => (
                <FeatureCard key={title} icon={WandSparkles} title={title} description={description} />
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-16 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Pricing preview</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Start simple. Grow with your workflow.</h2>
              <p className="mt-2 text-xs text-white/40">Explore Free, Pro, Team, and Enterprise plans.</p>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 px-4 py-3 text-xs font-semibold text-white/75 hover:border-cyan-300/30 hover:text-white md:self-center">
              Compare plans <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section className="px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.09] via-blue-500/[0.04] to-transparent p-8 text-center sm:p-14">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-200">
              <Sparkles size={20} />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Make your next idea real.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/45">Start with a plain-language brief, then keep shaping the result in your AI workspace.</p>
            <Link href="/projects/new" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black hover:bg-cyan-100">
              Create a project <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
