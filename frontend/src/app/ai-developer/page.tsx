"use client";

import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  FileCode2,
  FileJson,
  Folder,
  FolderOpen,
  GitBranch,
  Globe,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  Settings,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  downloadProjectZip,
  generatePreview,
  generateProject as generateProjectFromApi,
} from "../../../lib/api";

const files = [
  { name: "page.tsx", type: "tsx", active: true },
  { name: "layout.tsx", type: "tsx" },
  { name: "globals.css", type: "css" },
  { name: "package.json", type: "json" },
];

const code = `import { Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-8 py-24">
        <div className="max-w-3xl">
          <span className="text-cyan-400">
            AI SOFTWARE FACTORY
          </span>

          <h1 className="mt-5 text-6xl font-bold">
            Build something
            <br />
            extraordinary.
          </h1>

          <p className="mt-6 text-white/50">
            Your application is being generated
            by HexaWave AI.
          </p>

          <button className="mt-8 flex items-center gap-2
            rounded-xl bg-white px-6 py-3
            font-semibold text-black">
            Start building
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}`;

export default function AIDeveloperPage() {
  const [activeFile, setActiveFile] = useState("page.tsx");
  const [message, setMessage] = useState("");
  const [projectName] = useState("saas-platform");
  const [projectType] = useState("saas");
  const [projectStack] = useState("Next.js");
  const [projectDescription] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  const openLivePreview = async () => {
    try {
      setTerminalLines((current) => [...current, "Starting HexaWave Preview Engine..."]);
      const html = await generatePreview({
        projectName,
        projectType,
        stack: projectStack,
        prompt: message || projectDescription || "Build this software project.",
      });
      const blob = new Blob([html], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTerminalLines((current) => [...current, "✓ Live preview started."]);
    } catch {
      setTerminalLines((current) => [...current, "✕ Preview failed."]);
    }
  };

  const downloadProject = async () => {
    try {
      setTerminalLines((current) => [...current, "Packaging generated project..."]);
      await downloadProjectZip({
        projectName,
        projectType,
        stack: projectStack,
        prompt: message || projectDescription || "Build this software project.",
      });
      setTerminalLines((current) => [...current, "✓ Project ZIP downloaded successfully."]);
    } catch (error) {
      setTerminalLines((current) => [...current, "✕ ZIP generation failed."]);
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-[#080a0f] text-white">
      <div className="flex h-full flex-col">

        {/* TOP BAR */}
        <header className="flex h-12 shrink-0 items-center border-b border-white/[0.07] bg-[#0b0e14]">

          <div className="flex h-full w-[245px] items-center border-r border-white/[0.07] px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600">
              <Sparkles size={14} />
            </div>

            <div className="ml-2">
              <div className="text-[11px] font-bold">
                Hexa<span className="text-cyan-300">Wave</span>
              </div>
              <div className="text-[7px] uppercase tracking-[0.2em] text-white/25">
                AI Developer
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2 px-3">
            <div className="flex items-center gap-2 rounded-md bg-white/[0.05] px-3 py-1.5 text-[10px] text-white/50">
              <FolderOpen size={12} className="text-cyan-300" />
              saas-platform
              <ChevronDown size={11} />
            </div>

            <div className="text-white/15">/</div>

            <div className="text-[10px] text-white/35">
              {activeFile}
            </div>
          </div>

          <div className="flex items-center gap-1 px-2">
            <button className="rounded-md p-2 text-white/35 hover:bg-white/5 hover:text-white">
              <GitBranch size={14} />
            </button>

            <button className="rounded-md p-2 text-white/35 hover:bg-white/5 hover:text-white">
              <Settings size={14} />
            </button>

            <button className="ml-1 flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-3 py-1.5 text-[9px] font-semibold text-emerald-300">
              <Circle size={7} fill="currentColor" />
              Online
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">

          {/* ACTIVITY BAR */}
          <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/[0.07] bg-[#080a0f] py-3">

            <button className="mb-3 rounded-lg bg-cyan-400/10 p-2.5 text-cyan-300">
              <Code2 size={17} />
            </button>

            <button className="p-2.5 text-white/25 hover:text-white">
              <Search size={17} />
            </button>

            <button className="p-2.5 text-white/25 hover:text-white">
              <GitBranch size={17} />
            </button>

            <button className="p-2.5 text-white/25 hover:text-white">
              <Bot size={17} />
            </button>

            <div className="mt-auto">
              <button className="p-2.5 text-white/25 hover:text-white">
                <Settings size={17} />
              </button>
            </div>
          </aside>

          {/* EXPLORER */}
          <aside className="hidden w-[230px] shrink-0 border-r border-white/[0.07] bg-[#0a0d12] lg:block">

            <div className="flex h-10 items-center justify-between border-b border-white/[0.05] px-4">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                Explorer
              </span>

              <button className="text-white/25 hover:text-white">
                <Plus size={14} />
              </button>
            </div>

            <div className="p-3">

              <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-white/60">
                <ChevronDown size={12} />
                <FolderOpen size={13} className="text-cyan-300" />
                SAAS-PLATFORM
              </div>

              <div className="ml-3 border-l border-white/[0.06] pl-2">

                <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-[9px] text-white/40">
                  <ChevronRight size={10} />
                  <Folder size={12} className="text-blue-300" />
                  app
                </div>

                <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-[9px] text-white/40">
                  <ChevronRight size={10} />
                  <Folder size={12} className="text-blue-300" />
                  components
                </div>

                {files.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFile(file.name)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[9px] ${
                      activeFile === file.name
                        ? "bg-cyan-400/10 text-cyan-300"
                        : "text-white/40 hover:bg-white/[0.03] hover:text-white"
                    }`}
                  >
                    {file.type === "json" ? (
                      <FileJson size={12} />
                    ) : (
                      <FileCode2 size={12} />
                    )}
                    {file.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* CENTER EDITOR */}
          <section className="flex min-w-0 flex-1 flex-col bg-[#090c12]">

            {/* TABS */}
            <div className="flex h-10 shrink-0 overflow-x-auto border-b border-white/[0.06] bg-[#080a0f]">

              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setActiveFile(file.name)}
                  className={`flex min-w-fit items-center gap-2 border-r border-white/[0.05] px-4 text-[9px] ${
                    activeFile === file.name
                      ? "border-t border-t-cyan-300 bg-[#0d1017] text-white"
                      : "text-white/30"
                  }`}
                >
                  <FileCode2 size={11} />
                  {file.name}
                  {activeFile === file.name && (
                    <X size={10} className="ml-2 text-white/20" />
                  )}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2 px-3">
                <button
                  type="button"
                  onClick={openLivePreview}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={downloadProject}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Download Project
                </button>
                <button className="flex items-center gap-1.5 rounded-md bg-cyan-400/10 px-2.5 py-1.5 text-[9px] font-semibold text-cyan-300">
                  <Play size={10} fill="currentColor" />
                  Run
                </button>
              </div>
            </div>

            {/* EDITOR */}
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="flex min-w-[650px]">
                <div className="w-12 shrink-0 select-none border-r border-white/[0.04] bg-[#080a0f] py-4 text-right text-[10px] leading-[19px] text-white/15">
                  {Array.from({ length: 40 }, (_, i) => (
                    <div key={i} className="pr-3">
                      {i + 1}
                    </div>
                  ))}
                </div>

                <pre className="overflow-x-auto p-4 text-[11px] leading-[19px] text-white/65">
                  <code>
                    {code}
                  </code>
                </pre>
              </div>
            </div>

            {/* BOTTOM PANEL */}
            <div className="hidden h-36 shrink-0 border-t border-white/[0.07] bg-[#07090e] md:block">

              <div className="flex h-9 items-center gap-5 border-b border-white/[0.05] px-4">
                <button className="text-[9px] font-semibold text-white">
                  TERMINAL
                </button>

                <button className="text-[9px] text-white/25">
                  PROBLEMS
                </button>

                <button className="text-[9px] text-white/25">
                  OUTPUT
                </button>

                <div className="ml-auto flex items-center gap-2 text-[8px] text-emerald-300">
                  <Circle size={6} fill="currentColor" />
                  Build ready
                </div>
              </div>

              <div className="p-4 font-mono text-[9px] leading-5 text-white/30">
                <div><span className="text-cyan-300">➜</span> saas-platform npm run dev</div>
                <div className="text-emerald-300/60">✓ Ready in 1.4s</div>
                <div>○ Local: http://localhost:3000</div>
                {terminalLines.map((line, i) => (
                  <div
                    key={i}
                    className={line.startsWith("✓") ? "text-emerald-300/60" : line.startsWith("✕") ? "text-red-400/70" : "text-white/40"}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AI PANEL */}
          <aside className="hidden w-[330px] shrink-0 flex-col border-l border-white/[0.07] bg-[#090c12] xl:flex">

            <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-400/10">
                  <Sparkles size={12} className="text-cyan-300" />
                </div>

                <span className="text-[10px] font-semibold">
                  HexaWave AI
                </span>
              </div>

              <span className="text-[8px] text-emerald-300">
                Ready
              </span>
            </div>

            <div className="flex-1 overflow-auto p-4">

              <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-center gap-2 text-[9px] font-semibold">
                  <Zap size={11} className="text-cyan-300" />
                  Project context
                </div>

                <div className="mt-3 space-y-2 text-[8px] text-white/30">
                  <div className="flex justify-between">
                    <span>Files</span>
                    <span className="text-white/50">24</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Framework</span>
                    <span className="text-white/50">Next.js</span>
                  </div>

                  <div className="flex justify-between">
                    <span>TypeScript</span>
                    <span className="text-emerald-300">Active</span>
                  </div>
                </div>
              </div>

              <div className="mb-4 max-w-[90%] rounded-xl rounded-tl-sm border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold text-cyan-300">
                  <Bot size={12} />
                  HexaWave
                </div>

                <p className="text-[9px] leading-5 text-white/45">
                  I’m ready to work on your project. Ask me to create,
                  modify, debug or explain anything.
                </p>
              </div>

              <div className="mb-4 ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-cyan-400/10 p-3">
                <p className="text-[9px] leading-5 text-cyan-100/70">
                  Make the landing page more premium and add a modern
                  hero section.
                </p>
              </div>

              <div className="max-w-[90%] rounded-xl rounded-tl-sm border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold text-cyan-300">
                  <Sparkles size={11} />
                  AI Developer
                </div>

                <p className="text-[9px] leading-5 text-white/45">
                  Done. I updated the hero direction with a premium
                  dark interface, stronger hierarchy and responsive
                  layout.
                </p>

                <div className="mt-3 rounded-lg bg-black/30 p-2 text-[8px] text-emerald-300/70">
                  ✓ 4 files updated
                  <br />
                  ✓ Build passed
                  <br />
                  ✓ 0 errors
                </div>
              </div>
            </div>

            {/* AI INPUT */}
            <div className="border-t border-white/[0.07] p-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] focus-within:border-cyan-300/25">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask HexaWave to change your software..."
                  className="h-20 w-full resize-none bg-transparent p-3 text-[9px] text-white outline-none placeholder:text-white/20"
                />

                <div className="flex items-center justify-between border-t border-white/[0.05] px-2 py-2">
                  <div className="flex items-center gap-1">
                    <button className="rounded-md p-1.5 text-white/25 hover:bg-white/5 hover:text-white">
                      <Plus size={13} />
                    </button>

                    <span className="text-[8px] text-white/20">
                      AI Developer
                    </span>
                  </div>

                  <button
                    onClick={() => setMessage("")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300 text-black transition hover:bg-cyan-200"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* STATUS BAR */}
        <footer className="flex h-6 shrink-0 items-center justify-between bg-cyan-400 px-3 text-[8px] font-medium text-black">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <GitBranch size={9} />
              main
            </span>
            <span>0 errors</span>
            <span>0 warnings</span>
          </div>

          <div className="flex items-center gap-4">
            <span>UTF-8</span>
            <span>TypeScript</span>
            <span className="flex items-center gap-1">
              <Globe size={9} />
              Preview
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
