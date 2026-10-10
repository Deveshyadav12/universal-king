"use client";

import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  GitBranch,
  Globe2,
  Layers3,
  Play,
  Rocket,
  Sparkles,
  Terminal,
  Wand2,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Wand2,
    title: "Describe",
    text: "Tell HexaWave what you want to build using natural language.",
  },
  {
    icon: Layers3,
    title: "Architect",
    text: "AI creates the application structure, architecture and technology plan.",
  },
  {
    icon: Code2,
    title: "Generate",
    text: "Turn the specification into a real multi-file software project.",
  },
  {
    icon: Terminal,
    title: "Test",
    text: "Run builds, inspect errors and continuously improve the generated software.",
  },
  {
    icon: Rocket,
    title: "Deploy",
    text: "Prepare your application for production with a deployment workflow.",
  },
  {
    icon: Bot,
    title: "Iterate",
    text: "Keep talking to your AI developer and evolve the project.",
  },
];

const stats = [
  { value: "10×", label: "Faster prototyping" },
  { value: "24/7", label: "AI development" },
  { value: "∞", label: "Ideas to build" },
  { value: "1", label: "Unified workspace" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Explore the HexaWave workflow.",
    features: ["3 projects", "AI planning", "Basic generation", "Community support"],
  },
  {
    name: "Pro",
    price: "$29",
    description: "For serious builders and creators.",
    popular: true,
    features: [
      "Unlimited projects",
      "Advanced AI developer",
      "Code generation",
      "Build & test",
      "Deployment workflow",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: "$99",
    description: "For teams building products.",
    features: [
      "Everything in Pro",
      "Team workspaces",
      "Advanced agents",
      "Usage analytics",
      "Organization controls",
      "Priority infrastructure",
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-[-360px] h-[760px] w-[1100px] -translate-x-1/2 rounded-full bg-cyan-500/[0.10] blur-[150px]" />
        <div className="absolute left-[-250px] top-[850px] h-[600px] w-[600px] rounded-full bg-blue-600/[0.09] blur-[150px]" />
        <div className="absolute right-[-300px] top-[1250px] h-[650px] w-[650px] rounded-full bg-violet-600/[0.08] blur-[160px]" />
      </div>

      <nav className="relative z-30 border-b border-white/[0.07] bg-[#05070b]/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] border border-cyan-300/20 bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600 shadow-[0_0_35px_rgba(34,211,238,0.20)]">
              <Sparkles size={19} strokeWidth={2.4} />
            </div>
            <div>
              <div className="text-[17px] font-bold tracking-[-0.02em]">
                Hexa<span className="text-cyan-300">Wave</span>
              </div>
              <div className="text-[8px] font-semibold uppercase tracking-[0.25em] text-white/35">
                AI Software Factory
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-8 text-[13px] text-white/50 lg:flex">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#workflow" className="transition hover:text-white">Workflow</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden rounded-lg px-4 py-2.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white sm:block">
              Sign in
            </button>
            <button className="group flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[13px] font-bold text-black transition hover:bg-cyan-50">
              Start building
              <ArrowRight size={14} className="transition group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </nav>

      <section id="product" className="relative z-10 px-5 pb-28 pt-24 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <motion.div
              suppressHydrationWarning
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-4 py-2 text-[11px] font-semibold tracking-wide text-cyan-200"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
              THE NEXT GENERATION OF SOFTWARE DEVELOPMENT
              <ChevronRight size={13} />
            </motion.div>

            <motion.h1
              suppressHydrationWarning
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="text-[clamp(3.4rem,8vw,7.8rem)] font-semibold leading-[0.9] tracking-[-0.065em]"
            >
              Build software
              <br />
              <span className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent">
                with intelligence.
              </span>
            </motion.h1>

            <motion.p
              suppressHydrationWarning
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16 }}
              className="mx-auto mt-8 max-w-2xl text-[15px] leading-7 text-white/45 sm:text-[17px]"
            >
              HexaWave transforms your ideas into software. Describe the
              product, let AI architect it, generate the code, test it and
              prepare it for deployment.
            </motion.p>

            <motion.div
              suppressHydrationWarning
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24 }}
              className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
            >
              <button className="group flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-black shadow-[0_15px_50px_rgba(255,255,255,0.09)] transition hover:scale-[1.02] hover:bg-cyan-50">
                Start building for free
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </button>

              <button className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-7 py-3.5 text-sm font-semibold text-white/75 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                <Play size={15} fill="currentColor" />
                Watch demo
              </button>
            </motion.div>
          </div>

          <motion.div
            suppressHydrationWarning
            initial={{ opacity: 0, y: 45 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="relative mx-auto mt-20 max-w-6xl"
          >
            <div className="absolute -inset-10 rounded-[40px] bg-cyan-500/[0.07] blur-3xl" />

            <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] bg-[#090c12] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
              <div className="flex h-11 items-center border-b border-white/[0.07] bg-white/[0.018] px-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </div>

                <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.025] px-4 py-1.5 text-[10px] text-white/35">
                  <span className="text-cyan-300">●</span>
                  HexaWave AI Developer
                </div>

                <div className="w-12" />
              </div>

              <div className="grid min-h-[450px] grid-cols-12">
                <aside className="col-span-2 hidden border-r border-white/[0.06] bg-[#07090e] p-3 md:block">
                  <div className="mb-4 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                    Workspace
                  </div>

                  {[
                    ["◈", "Overview"],
                    ["◇", "Projects"],
                    ["⌁", "AI Developer"],
                    ["□", "Deployments"],
                  ].map(([icon, label], i) => (
                    <div
                      key={label}
                      className={`mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
                        i === 2
                          ? "bg-cyan-400/10 text-cyan-300"
                          : "text-white/35"
                      }`}
                    >
                      <span>{icon}</span>
                      {label}
                    </div>
                  ))}
                </aside>

                <div className="col-span-12 p-5 md:col-span-7 lg:p-7">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-white/35">AI Developer</div>
                      <div className="mt-1 text-lg font-semibold">
                        Build your next product
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-emerald-400/10 bg-emerald-400/[0.06] px-3 py-2 text-[9px] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      AI Online
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm border border-white/[0.06] bg-white/[0.035] p-4">
                      <div className="text-[10px] leading-5 text-white/65">
                        Build me a modern SaaS dashboard where users can
                        create projects and generate applications with AI.
                      </div>
                    </div>

                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-cyan-400/10 bg-cyan-400/[0.035] p-4">
                      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-cyan-300">
                        <Bot size={13} />
                        HexaWave Architect
                      </div>

                      <div className="space-y-2">
                        {[
                          ["Architecture", "Complete"],
                          ["UI System", "Complete"],
                          ["Project structure", "Generating"],
                          ["API integration", "Pending"],
                        ].map(([a, b], i) => (
                          <div
                            key={a}
                            className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2 text-[9px] text-white/45">
                              <span className="text-cyan-300">
                                {i < 2 ? "✓" : "○"}
                              </span>
                              {a}
                            </div>
                            <span className="text-[8px] text-white/25">
                              {b}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="col-span-3 hidden border-l border-white/[0.06] bg-[#07090e] p-5 lg:block">
                  <div className="mb-5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                    Project
                  </div>

                  <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Code2 size={13} className="text-cyan-300" />
                      <span className="text-[10px] font-medium">saas-app</span>
                    </div>

                    <div className="space-y-2 text-[8px] text-white/30">
                      <div>⌄ app</div>
                      <div className="pl-3">◻ page.tsx</div>
                      <div className="pl-3">◻ dashboard.tsx</div>
                      <div>⌄ components</div>
                      <div className="pl-3">◻ sidebar.tsx</div>
                      <div className="pl-3">◻ project-card.tsx</div>
                    </div>
                  </div>

                  <div className="text-[9px] text-white/25">BUILD STATUS</div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      suppressHydrationWarning
                      initial={{ width: 0 }}
                      animate={{ width: "72%" }}
                      transition={{ duration: 1.5, delay: 1 }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-[8px] text-white/25">
                    <span>Generating</span>
                    <span>72%</span>
                  </div>
                </aside>
              </div>
            </div>
          </motion.div>

          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 border-y border-white/[0.06] sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border-r border-white/[0.06] px-5 py-7 text-center last:border-r-0"
              >
                <div className="text-2xl font-semibold tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/25">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative z-10 border-y border-white/[0.06] bg-white/[0.015] px-5 py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              One intelligent workflow
            </div>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              From idea to
              <span className="text-white/35"> working software.</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/40">
              HexaWave brings planning, development, testing and deployment
              into one AI-native workspace.
            </p>
          </div>

          <div id="features" className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-[#070a0f] p-7 transition hover:bg-[#0a0e15]"
                >
                  <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-cyan-300 transition group-hover:border-cyan-300/20 group-hover:bg-cyan-300/10">
                    <Icon size={18} />
                  </div>

                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/35">
                    {feature.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              <Cpu size={13} />
              AI-native development
            </div>

            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Your AI team,
              <br />
              inside one workspace.
            </h2>

            <p className="mt-6 max-w-lg text-sm leading-7 text-white/40">
              HexaWave can organize the software-building process into
              specialized AI roles, from architecture and development through
              testing and deployment.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "AI architecture planning",
                "Multi-file code generation",
                "Automated project analysis",
                "Build and test workflows",
                "Deployment preparation",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-xs text-white/55">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                    <Check size={11} />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-blue-500/[0.08] blur-3xl" />

            <div className="relative rounded-2xl border border-white/[0.08] bg-[#080b11] p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch size={14} className="text-cyan-300" />
                  <span className="text-xs font-semibold">AI agents</span>
                </div>
                <span className="text-[9px] text-emerald-300">6 active</span>
              </div>

              {[
                ["Researcher", "Analyzing requirements", "92%"],
                ["Architect", "Designing system", "76%"],
                ["Developer", "Generating components", "64%"],
                ["Tester", "Waiting for build", "—"],
                ["Reviewer", "Queued", "—"],
                ["Deployment", "Queued", "—"],
              ].map(([name, status, progress], i) => (
                <div
                  key={name}
                  className="mb-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          i < 3 ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.7)]" : "bg-white/15"
                        }`}
                      />
                      <div>
                        <div className="text-[10px] font-medium">{name}</div>
                        <div className="mt-0.5 text-[8px] text-white/25">
                          {status}
                        </div>
                      </div>
                    </div>

                    <span className="text-[8px] text-white/25">{progress}</span>
                  </div>

                  {i < 3 && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-cyan-400/70"
                        style={{ width: progress }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 border-t border-white/[0.06] bg-white/[0.015] px-5 py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              Simple pricing
            </div>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Start building.
            </h2>
            <p className="mt-5 text-sm text-white/35">
              Start free and upgrade when your software factory grows.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-7 ${
                  plan.popular
                    ? "border-cyan-300/30 bg-cyan-300/[0.045] shadow-[0_20px_70px_rgba(34,211,238,0.08)]"
                    : "border-white/[0.07] bg-[#080b10]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-cyan-300 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-black">
                    Popular
                  </div>
                )}

                <div className="text-sm font-semibold">{plan.name}</div>
                <div className="mt-3 text-xs text-white/35">{plan.description}</div>

                <div className="mt-7">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  {plan.price !== "$0" && (
                    <span className="ml-1 text-xs text-white/25">/ month</span>
                  )}
                </div>

                <button
                  className={`mt-7 w-full rounded-xl py-3 text-xs font-bold transition ${
                    plan.popular
                      ? "bg-white text-black hover:bg-cyan-50"
                      : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  }`}
                >
                  Get started
                </button>

                <div className="mt-7 space-y-3 border-t border-white/[0.06] pt-6">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-[11px] text-white/45"
                    >
                      <Check size={13} className="text-cyan-300" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-28 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.10] via-blue-500/[0.06] to-violet-500/[0.08] px-7 py-16 text-center sm:px-12">
          <div className="absolute left-1/2 top-[-150px] h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[100px]" />

          <div className="relative">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
              <Zap size={20} />
            </div>

            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Your next software starts here.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/40">
              Stop starting from an empty editor. Give HexaWave your idea and
              start building.
            </p>

            <button className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02]">
              Start building
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="text-xs font-bold">
                Hexa<span className="text-cyan-300">Wave</span>
              </div>
              <div className="text-[8px] text-white/25">
                AI SOFTWARE FACTORY
              </div>
            </div>
          </div>

          <div className="text-[10px] text-white/20">
            © 2026 HexaWave. Build the future.
          </div>
        </div>
      </footer>
    </main>
  );
}
