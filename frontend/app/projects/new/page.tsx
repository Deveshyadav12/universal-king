"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Globe,
  Layers3,
  Rocket,
  Sparkles,
  Smartphone,
  Database,
  Server,
  type LucideIcon,
} from "lucide-react";
import { createProject } from "@/lib/api";

type ProjectType = "Web App" | "Mobile App" | "API / Backend" | "SaaS";

const projectTypes: {
  name: ProjectType;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    name: "Web App",
    description: "Modern websites and web applications",
    icon: Globe,
  },
  {
    name: "Mobile App",
    description: "iOS and Android applications",
    icon: Smartphone,
  },
  {
    name: "API / Backend",
    description: "APIs, services and backend systems",
    icon: Server,
  },
  {
    name: "SaaS",
    description: "Complete subscription software",
    icon: Layers3,
  },
];

const stacks = [
  "Next.js + TypeScript",
  "React + TypeScript",
  "Node.js + TypeScript",
  "Python + FastAPI",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("Web App");
  const [stack, setStack] = useState(stacks[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const canContinue =
    name.trim().length >= 2 &&
    description.trim().length >= 10;

  const architecturePreview: {
    label: string;
    value: string;
    icon: LucideIcon;
  }[] = [
    { label: "Selected stack", value: stack, icon: Code2 },
    { label: "Project type", value: type, icon: Layers3 },
    { label: "Data layer", value: "Defined during AI planning", icon: Database },
    { label: "Architecture plan", value: "Generated in the AI Developer workspace", icon: Bot },
  ];

  async function createWorkspace() {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError("");
    try {
      const result = await createProject({
        name: name.trim(),
        type,
        stack,
        description: description.trim(),
      });
      const query = new URLSearchParams({
        id: result.project.id,
        project: name.trim(),
        type,
        stack,
        description: description.trim(),
      });
      router.push(`/ai-developer?${query.toString()}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create the project workspace.");
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-400/[0.07] blur-[130px]" />
        <div className="absolute bottom-[-200px] right-[-100px] h-[450px] w-[450px] rounded-full bg-blue-600/[0.06] blur-[130px]" />
      </div>

      <header className="relative z-10 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#070910]/80 px-5 backdrop-blur-xl lg:px-8">
        <a
          href="/dashboard"
          className="flex items-center gap-3 text-white/60 transition hover:text-white"
        >
          <ArrowLeft size={16} />

          <div>
            <div className="text-sm font-semibold text-white">
              Hexa<span className="text-cyan-300">Wave</span>
            </div>

            <div className="text-[8px] uppercase tracking-[0.2em] text-white/25">
              New Project
            </div>
          </div>
        </a>

        <div className="flex items-center gap-2">
          {[1, 2].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                  step >= item
                    ? "bg-cyan-300 text-black"
                    : "border border-white/10 text-white/25"
                }`}
              >
                {step > item ? <Check size={13} /> : item}
              </div>

              {item === 1 && (
                <div
                  className={`hidden h-px w-8 sm:block ${
                    step >= 2 ? "bg-cyan-300/60" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="hidden text-[10px] text-white/25 sm:block">
          AI Project Builder
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center px-5 py-12">

        {step === 1 ? (
          <section className="w-full max-w-4xl">

            <div className="mb-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                <Sparkles size={22} className="text-cyan-300" />
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                Step 01
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                What are you building?
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/35">
                Describe your idea in normal language. HexaWave will turn it
                into a structured software project.
              </p>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 shadow-2xl shadow-black/30 sm:p-7">

              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Project name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nova CRM"
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40 focus:bg-cyan-300/[0.02]"
              />

              <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Describe your software
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Build a modern CRM where sales teams can manage leads, contacts, deals, tasks and email follow-ups..."
                rows={6}
                className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40 focus:bg-cyan-300/[0.02]"
              />

              <div className="mt-7">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Project type
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {projectTypes.map((item) => {
                    const Icon = item.icon;
                    const active = type === item.name;

                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setType(item.name)}
                        className={`group rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-cyan-300/30 bg-cyan-300/[0.08]"
                            : "border-white/[0.07] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              active
                                ? "bg-cyan-300 text-black"
                                : "bg-white/[0.05] text-white/40"
                            }`}
                          >
                            <Icon size={17} />
                          </div>

                          <div>
                            <div className="text-xs font-semibold">
                              {item.name}
                            </div>

                            <div className="mt-1 text-[10px] leading-5 text-white/30">
                              {item.description}
                            </div>
                          </div>

                          {active && (
                            <Check
                              size={14}
                              className="ml-auto text-cyan-300"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                disabled={!canContinue}
                onClick={() => setStep(2)}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-xs font-bold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Continue
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        ) : (
          <section className="w-full max-w-5xl">

            <div className="mb-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-black">
                <Bot size={22} />
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                Project Setup
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Your project is ready to plan.
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/35">
                Review the project details and choose a stack. HexaWave will
                create a persistent workspace; AI planning starts in the IDE.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">

                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5">
                  <div>
                    <div className="text-sm font-semibold">
                      {name}
                    </div>

                    <div className="mt-1 text-[10px] text-white/25">
                      {type}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    Architecture preview
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                    Project description
                  </div>

                  <p className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs leading-6 text-white/45">
                    {description}
                  </p>
                </div>

                <div className="mt-7">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                    Starting architecture preview
                  </div>

                  <div className="space-y-2">
                    {architecturePreview.map(({ label, value, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/[0.08] text-cyan-300">
                          <Icon size={14} />
                        </div>

                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-white/25">
                            {label}
                          </div>

                          <div className="mt-0.5 text-xs text-white/70">
                            {value}
                          </div>
                        </div>

                        <Check
                          size={14}
                          className="ml-auto text-emerald-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/15 bg-gradient-to-b from-cyan-300/[0.08] to-blue-500/[0.03] p-6">

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Code2 size={15} className="text-cyan-300" />
                  Technology Stack
                </div>

                <p className="mt-2 text-[10px] leading-5 text-white/30">
                  Choose the foundation HexaWave should use.
                </p>

                <div className="mt-5 space-y-2">
                  {stacks.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStack(item)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-[11px] transition ${
                        stack === item
                          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                          : "border-white/[0.06] bg-white/[0.02] text-white/45 hover:bg-white/[0.04]"
                      }`}
                    >
                      {item}

                      {stack === item && <Check size={13} />}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/25">
                    Selected
                  </div>

                  <div className="mt-2 text-xs font-semibold">
                    {stack}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void createWorkspace()}
                  disabled={isCreating}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-xs font-bold text-black transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <Rocket size={14} />
                  {isCreating ? "Creating workspace…" : "Create workspace"}
                </button>

                {createError && (
                  <p role="alert" className="mt-3 text-xs leading-5 text-red-300">
                    {createError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-[10px] text-white/30 hover:text-white"
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
