"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Code2,
  FileCode2,
  FileJson,
  Folder,
  FolderOpen,
  GitBranch,
  Globe,
  MessageSquare,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Terminal,
  X,
  Zap,
} from "lucide-react";

type ProjectFile = {
  name: string;
  type: "folder" | "file";
  language?: string;
  content?: string;
};

type Message = {
  role: "user" | "assistant";
  text: string;
};

const initialFiles: ProjectFile[] = [
  {
    name: "src",
    type: "folder",
  },
  {
    name: "app",
    type: "folder",
  },
  {
    name: "page.tsx",
    type: "file",
    language: "tsx",
    content: `export default function Home() {
  return (
    <main className="min-h-screen">
      <h1>Welcome to your HexaWave project</h1>
      <p>Start building with AI.</p>
    </main>
  );
}`,
  },
  {
    name: "layout.tsx",
    type: "file",
    language: "tsx",
    content: `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
  },
  {
    name: "package.json",
    type: "file",
    language: "json",
    content: `{
  "name": "hexawave-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}`,
  },
  {
    name: "README.md",
    type: "file",
    language: "md",
    content: `# HexaWave Project

Generated with HexaWave AI Software Factory.

## Getting Started

Run npm install and npm run dev.`,
  },
];

export default function AIDeveloperPage() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "Nova Project";
  const projectType = searchParams.get("type") || "Web App";
  const projectStack = searchParams.get("stack") || "Next.js + TypeScript";
  const projectDescription = searchParams.get("description") || "AI generated software project";
  const [files, setFiles] = useState(initialFiles);
  const [activeFile, setActiveFile] = useState("page.tsx");
  const [editorContent, setEditorContent] = useState(
    initialFiles.find((file) => file.name === "page.tsx")?.content || ""
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `I'm ready to build ${projectName}. I understand this is a ${projectType} using ${projectStack}. Your goal is: ${projectDescription}` ,
    },
  ]);

  const [message, setMessage] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "$ HexaWave Terminal",
    "Project workspace initialized.",
    "Ready for commands.",
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [preview, setPreview] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);

  function openFile(file: ProjectFile) {
    if (file.type !== "file") return;

    setActiveFile(file.name);
    setEditorContent(file.content || "");
  }

  function saveFile() {
    setFiles((current) =>
      current.map((file) =>
        file.name === activeFile
          ? {
              ...file,
              content: editorContent,
            }
          : file
      )
    );

    setTerminalLines((current) => [
      ...current,
      `✓ Saved ${activeFile}`,
    ]);
  }

  function runProject() {
    if (isRunning) return;

    setIsRunning(true);

    setTerminalLines((current) => [
      ...current,
      "",
      "$ npm run dev",
      "> hexawave-project@1.0.0 dev",
      "> next dev",
      "",
      "▲ Next.js development server starting...",
    ]);

    setTimeout(() => {
      setTerminalLines((current) => [
        ...current,
        "✓ Ready in 1.2s",
        "○ Local: http://localhost:3000",
      ]);

      setIsRunning(false);
    }, 1600);
  }

  function buildProject() {
    if (isBuilding) return;

    setIsBuilding(true);

    setTerminalLines((current) => [
      ...current,
      "",
      "$ npm run build",
      "Creating optimized production build...",
    ]);

    setTimeout(() => {
      setTerminalLines((current) => [
        ...current,
        "✓ Compiled successfully",
        "✓ TypeScript checks passed",
        "✓ Build completed",
        "0 errors · 0 warnings",
      ]);

      setIsBuilding(false);
    }, 1800);
  }

  function sendMessage() {
    const value = message.trim();

    if (!value) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: value,
      },
    ]);

    setMessage("");

    setTimeout(() => {
      const lower = value.toLowerCase();

      let response =
        "I understand. I would update the project architecture and generate the required files. This frontend demo is ready for the real AI backend connection.";

      if (lower.includes("button")) {
        response =
          "I'll add the button with a modern HexaWave style, responsive states and the required click behavior.";
      } else if (lower.includes("dashboard")) {
        response =
          "I'll create a responsive dashboard with navigation, project cards, activity metrics and AI-powered actions.";
      } else if (
        lower.includes("website") ||
        lower.includes("web app")
      ) {
        response =
          "Great. I'll structure the application with a modern frontend, reusable components, responsive layouts and a clean production-ready architecture.";
      } else if (
        lower.includes("crm") ||
        lower.includes("customer")
      ) {
        response =
          "I'll design the CRM around contacts, leads, deals, tasks and activity tracking, then generate the corresponding UI and data structure.";
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response,
        },
      ]);
    }, 700);
  }

  function addFile() {
    const fileName = window.prompt(
      "Enter a new file name",
      "new-component.tsx"
    );

    if (!fileName?.trim()) return;

    const newFile: ProjectFile = {
      name: fileName.trim(),
      type: "file",
      language: fileName.endsWith(".tsx")
        ? "tsx"
        : fileName.endsWith(".ts")
          ? "ts"
          : fileName.endsWith(".json")
            ? "json"
            : "txt",
      content: "",
    };

    setFiles((current) => [...current, newFile]);
    setActiveFile(newFile.name);
    setEditorContent("");
  }

  return (
    <main className="h-screen overflow-hidden bg-[#080a0f] text-white">

      <header className="flex h-12 items-center border-b border-white/[0.07] bg-[#0b0e14]">

        <div className="flex h-full w-14 items-center justify-center border-r border-white/[0.07]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-black">
            <Zap size={14} />
          </div>
        </div>

        <div className="flex h-full items-center gap-3 border-r border-white/[0.07] px-4">
          <div className="text-xs font-semibold">
            Hexa<span className="text-cyan-300">Wave</span>
          </div>

          <span className="text-white/15">/</span>

          <span className="text-[11px] text-white/45">
            {projectName}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-white/50">
              AI Online
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2">
          <button
            onClick={saveFile}
            className="rounded-md px-3 py-1.5 text-[10px] text-white/45 hover:bg-white/[0.05] hover:text-white"
          >
            Save
          </button>

          <button
            onClick={buildProject}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/55 hover:bg-white/[0.05] hover:text-white"
          >
            <Rocket size={12} />
            {isBuilding ? "Building..." : "Build"}
          </button>

          <button
            onClick={runProject}
            className="flex items-center gap-1.5 rounded-md bg-cyan-300 px-3 py-1.5 text-[10px] font-bold text-black hover:bg-cyan-200"
          >
            {isRunning ? <Square size={11} /> : <Play size={11} />}
            {isRunning ? "Running" : "Run"}
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">

        <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/[0.07] bg-[#090b10] py-3">

          {[
            Folder,
            Search,
            GitBranch,
            Bot,
            Rocket,
            Settings,
          ].map((Icon, index) => (
            <button
              key={index}
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${
                index === 0
                  ? "bg-white/[0.06] text-cyan-300"
                  : "text-white/25 hover:bg-white/[0.04] hover:text-white/60"
              }`}
            >
              <Icon size={17} />
            </button>
          ))}

          <div className="mt-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] text-[9px] text-white/40">
            D
          </div>
        </aside>

        {explorerOpen && (
          <aside className="hidden w-60 shrink-0 border-r border-white/[0.07] bg-[#0b0e14] md:block">

            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                Explorer
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={addFile}
                  className="rounded p-1 text-white/30 hover:bg-white/[0.05] hover:text-white"
                >
                  <Plus size={13} />
                </button>

                <button
                  onClick={() => setExplorerOpen(false)}
                  className="rounded p-1 text-white/30 hover:bg-white/[0.05] hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="px-2 py-3">

              <div className="mb-2 flex items-center gap-1 px-2 text-[10px] font-semibold text-white/55">
                <ChevronDown size={13} />
                NOVA-PROJECT
              </div>

              <div className="ml-2 space-y-0.5">

                {files.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => openFile(file)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] ${
                      activeFile === file.name
                        ? "bg-cyan-300/10 text-cyan-200"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                    }`}
                  >
                    {file.type === "folder" ? (
                      <>
                        <ChevronRight size={12} />
                        <Folder size={13} className="text-blue-300/60" />
                      </>
                    ) : file.language === "json" ? (
                      <FileJson size={13} className="text-yellow-300/60" />
                    ) : (
                      <FileCode2 size={13} className="text-cyan-300/60" />
                    )}

                    {file.name}
                  </button>
                ))}

              </div>
            </div>
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">

          <div className="flex h-9 shrink-0 overflow-x-auto border-b border-white/[0.07] bg-[#0a0c12]">

            {!explorerOpen && (
              <button
                onClick={() => setExplorerOpen(true)}
                className="flex items-center gap-1 border-r border-white/[0.06] px-3 text-[10px] text-white/35 hover:text-white"
              >
                <FolderOpen size={13} />
                Explorer
              </button>
            )}

            <div className="flex items-center gap-2 border-r border-white/[0.07] bg-[#10131a] px-4">
              <FileCode2 size={13} className="text-cyan-300/70" />
              <span className="text-[10px] text-white/65">
                {activeFile}
              </span>

              <span className="ml-2 text-white/20">
                ×
              </span>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col bg-[#080a0f]">

            <div className="flex min-h-0 flex-1">

              <div className="hidden w-10 shrink-0 border-r border-white/[0.04] py-4 text-right text-[10px] leading-6 text-white/15 sm:block">
                {editorContent.split("\n").map((_, index) => (
                  <div key={index} className="pr-2">
                    {index + 1}
                  </div>
                ))}
              </div>

              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[12px] leading-6 text-white/75 outline-none"
              />

            </div>

            <div className="flex h-8 shrink-0 items-center border-t border-white/[0.06] bg-[#0b0e14] px-3 text-[9px] text-white/30">
              <span>{activeFile}</span>
              <span className="mx-2 text-white/10">•</span>
              <span>UTF-8</span>
              <span className="mx-2 text-white/10">•</span>
              <span>TypeScript React</span>

              <span className="ml-auto flex items-center gap-1 text-emerald-300/70">
                <Activity size={10} />
                Ready
              </span>
            </div>
          </div>

          <div className="h-44 shrink-0 border-t border-white/[0.07] bg-[#07090d]">

            <div className="flex h-9 items-center gap-5 border-b border-white/[0.06] px-4">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-white/55">
                <Terminal size={12} />
                Terminal
              </div>

              <div className="text-[9px] text-white/25">
                Problems
              </div>

              <div className="text-[9px] text-white/25">
                Output
              </div>
            </div>

            <div className="h-[calc(100%-36px)] overflow-auto p-3 font-mono text-[10px] leading-5">
              {terminalLines.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.includes("✓")
                      ? "text-emerald-300/80"
                      : line.startsWith("$")
                        ? "text-cyan-300/80"
                        : "text-white/35"
                  }
                >
                  {line || "\u00A0"}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="hidden w-80 shrink-0 flex-col border-l border-white/[0.07] bg-[#0a0d13] xl:flex">

          <div className="border-b border-white/[0.06] bg-cyan-300/[0.025] px-4 py-3">
  <div className="flex items-center gap-2">
    <Sparkles size={12} className="text-cyan-300" />
    <span className="text-[10px] font-semibold text-white/70">
      Project Context
    </span>
  </div>

  <div className="mt-2 truncate text-xs font-semibold text-white">
    {projectName}
  </div>

  <div className="mt-1 flex items-center gap-2 text-[9px] text-white/30">
    <span>{projectType}</span>
    <span>•</span>
    <span>{projectStack}</span>
  </div>
</div>
<div className="flex h-10 items-center border-b border-white/[0.06] px-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <Bot size={14} className="text-cyan-300" />
              HexaWave AI
            </div>

            <div className="ml-auto flex items-center gap-1 text-[8px] text-emerald-300/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-4">

            {messages.map((item, index) => (
              <div
                key={index}
                className={
                  item.role === "user"
                    ? "ml-6 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.07] p-3"
                    : "mr-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"
                }
              >
                <div className="mb-2 flex items-center gap-2">
                  {item.role === "assistant" ? (
                    <Sparkles size={11} className="text-cyan-300" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-cyan-300/20" />
                  )}

                  <span className="text-[9px] font-semibold text-white/45">
                    {item.role === "assistant" ? "HexaWave AI" : "You"}
                  </span>
                </div>

                <p className="text-[10px] leading-5 text-white/50">
                  {item.text}
                </p>
              </div>
            ))}

          </div>

          <div className="border-t border-white/[0.06] p-3">

            <div className="rounded-xl border border-white/[0.08] bg-black/20 p-2">

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                placeholder="Ask AI to build or change something..."
                className="w-full resize-none bg-transparent px-2 py-1 text-[10px] leading-5 text-white outline-none placeholder:text-white/20"
              />

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[8px] text-white/20">
                  Enter to send
                </div>

                <button
                  onClick={sendMessage}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300 text-black transition hover:bg-cyan-200"
                >
                  <Send size={12} />
                </button>
              </div>

            </div>
          </div>
        </aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14] shadow-2xl">

            <div className="flex h-11 items-center gap-3 border-b border-white/[0.07] px-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              </div>

              <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-8 py-1.5 text-[9px] text-white/30">
                <Globe size={11} />
                localhost:3000
              </div>

              <button
                onClick={() => setPreview(false)}
                className="text-white/30 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center bg-white">
              <div className="text-center text-black">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white">
                  <Zap size={28} />
                </div>

                <h2 className="text-2xl font-bold">
                  Your HexaWave App
                </h2>

                <p className="mt-2 text-sm text-black/50">
                  Preview is connected to your project workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setPreview(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-[10px] font-bold text-cyan-200 shadow-xl backdrop-blur-xl hover:bg-cyan-300/20"
      >
        <Globe size={13} />
        Preview
      </button>
    </main>
  );
}



