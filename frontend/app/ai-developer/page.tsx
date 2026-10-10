"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  buildProject as buildProjectFromApi,
  createProject as createProjectFromApi,
  downloadWorkspaceZip,
  editProjectFileWithAi,
  generateProject as generateProjectFromApi,
  getAiHealth,
  getProjectFile,
  getProjectFiles,
  getProjectStatus,
  maintainProjectWithAi,
  runAutonomousProjectTask,
  ProjectFile as ApiProjectFile,
  ProjectStatus,
  runProject as runProjectFromApi,
  stopProject as stopProjectFromApi,
  updateProjectFile,
} from "../../lib/api";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  Folder,
  FolderOpen,
  Globe,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
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

type GenerationMode = "fast" | "full";
type ActivityView = "explorer" | "search";
type ConsoleTab = "Terminal" | "Problems" | "Output";

const frontendHostingOptions = [
  "Azure Static Web Apps",
  "Azure App Service",
  "Azure Container Apps",
  "Vercel",
  "Netlify",
  "Cloudflare Pages",
  "Self-hosted",
] as const;

const backendHostingOptions = [
  "Azure App Service",
  "Azure Container Apps",
  "AWS App Runner",
  "Google Cloud Run",
  "Self-hosted",
] as const;

type FrameworkChoice = {
  name: string;
  hosts: readonly string[];
};

const universalHosts = ["Azure Container Apps", "Google Cloud Run", "Self-hosted"];
const frontendFrameworks: Record<string, FrameworkChoice[]> = {
  TypeScript: [
    { name: "Next.js", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Self-hosted"] },
    { name: "React + Vite", hosts: [...frontendHostingOptions] },
    { name: "Angular", hosts: [...frontendHostingOptions] },
    { name: "Vue + Nuxt", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
    { name: "Svelte + SvelteKit", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
    { name: "Astro", hosts: [...frontendHostingOptions] },
    { name: "SolidStart", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
    { name: "Qwik", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
  ],
  JavaScript: [
    { name: "Next.js", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Self-hosted"] },
    { name: "React + Vite", hosts: [...frontendHostingOptions] },
    { name: "Angular", hosts: [...frontendHostingOptions] },
    { name: "Vue + Nuxt", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
    { name: "Svelte + SvelteKit", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
    { name: "Astro", hosts: [...frontendHostingOptions] },
    { name: "SolidStart", hosts: ["Azure App Service", "Azure Container Apps", "Vercel", "Netlify", "Self-hosted"] },
  ],
  "HTML/CSS": [
    { name: "Static HTML/CSS", hosts: [...frontendHostingOptions] },
    { name: "Bootstrap", hosts: [...frontendHostingOptions] },
    { name: "Tailwind CSS", hosts: [...frontendHostingOptions] },
  ],
  Dart: [{ name: "Flutter Web", hosts: [...universalHosts, "Azure App Service", "Vercel", "Netlify"] }],
  Python: [{ name: "PyScript / Pyodide", hosts: [...frontendHostingOptions] }],
  "C#": [{ name: "Blazor WebAssembly", hosts: [...frontendHostingOptions] }],
  Rust: [
    { name: "Leptos", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Yew", hosts: [...frontendHostingOptions] },
    { name: "Dioxus", hosts: [...universalHosts, "Azure App Service"] },
  ],
  Java: [
    { name: "Vaadin", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Jmix", hosts: [...universalHosts, "Azure App Service"] },
  ],
  Kotlin: [
    { name: "Compose Multiplatform", hosts: [...frontendHostingOptions] },
    { name: "KVision", hosts: [...frontendHostingOptions] },
  ],
  PHP: [{ name: "Laravel Blade", hosts: [...universalHosts, "Azure App Service"] }],
  Ruby: [{ name: "Rails views", hosts: [...universalHosts, "Azure App Service"] }],
  Go: [{ name: "Go templates + WebAssembly", hosts: [...universalHosts, "Azure App Service"] }],
};

const backendFrameworks: Record<string, FrameworkChoice[]> = {
  TypeScript: [
    { name: "NestJS", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Express", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Fastify", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
  ],
  JavaScript: [
    { name: "Express", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Fastify", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Koa", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
  ],
  Python: [
    { name: "FastAPI", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Django", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Flask", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
  ],
  Java: [
    { name: "Spring Boot", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Quarkus", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Micronaut", hosts: [...universalHosts, "Azure App Service"] },
  ],
  Kotlin: [
    { name: "Ktor", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Spring Boot", hosts: [...universalHosts, "Azure App Service"] },
  ],
  "C#": [
    { name: "ASP.NET Core", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
    { name: "Minimal API", hosts: [...universalHosts, "Azure App Service", "AWS App Runner"] },
  ],
  Go: [
    { name: "Gin", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Fiber", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Chi", hosts: [...universalHosts, "Azure App Service"] },
  ],
  PHP: [
    { name: "Laravel", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Symfony", hosts: [...universalHosts, "Azure App Service"] },
  ],
  Ruby: [
    { name: "Ruby on Rails", hosts: [...universalHosts, "Azure App Service"] },
    { name: "Sinatra", hosts: [...universalHosts, "Azure App Service"] },
  ],
  Rust: [
    { name: "Axum", hosts: [...universalHosts] },
    { name: "Actix Web", hosts: [...universalHosts] },
  ],
  Elixir: [{ name: "Phoenix", hosts: [...universalHosts] }],
  Scala: [{ name: "Play", hosts: [...universalHosts] }],
  Swift: [{ name: "Vapor", hosts: [...universalHosts] }],
};

const frontendLanguages = [
  "TypeScript", "JavaScript", "HTML/CSS", "Dart", "Python", "C#", "Rust",
  "Java", "Kotlin", "PHP", "Ruby", "Go", "Other / custom",
];
const backendLanguages = [
  "TypeScript", "JavaScript", "Python", "Java", "Kotlin", "C#", "Go",
  "PHP", "Ruby", "Rust", "Elixir", "Scala", "Swift", "Other / custom",
];

function compatibleFrameworks(
  catalog: Record<string, FrameworkChoice[]>,
  language: string,
  host: string,
): FrameworkChoice[] {
  return (catalog[language] ?? []).filter((framework) =>
    framework.hosts.includes(host),
  );
}

const quickStarts = [
  {
    title: "Business website",
    description: "A polished responsive landing page",
    prompt:
      "Create a polished, responsive business website with a strong hero, services, testimonials, pricing, and contact sections. Use accessible semantic HTML and a cohesive design system.",
  },
  {
    title: "SaaS dashboard",
    description: "A useful product dashboard UI",
    prompt:
      "Build a responsive SaaS dashboard with a left navigation, summary metrics, recent activity, and a data table. Include realistic sample data, empty states, and accessible interactions.",
  },
  {
    title: "API service",
    description: "A structured backend starter",
    prompt:
      "Create a maintainable API service starter using the selected stack, with a health endpoint, input validation, clear error responses, and a short README explaining how to run it.",
  },
];

function AIDeveloperWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "Nova Project";
  const projectType = searchParams.get("type") || "Web App";
  const projectStack = searchParams.get("stack") || "Next.js + TypeScript";
  const projectDescription = searchParams.get("description") || "AI generated software project";
  const isMaintenanceMode = searchParams.get("mode") === "maintenance";
  const [projectId, setProjectId] = useState(searchParams.get("id") || "");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [editorContent, setEditorContent] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: isMaintenanceMode
        ? `${projectName} is imported into the maintenance workspace. Ask for a single-file edit or project-wide maintenance, then review the changed files and run the available build/tests. Known sensitive, unsupported, and oversized files are excluded from project-wide AI context. Detected stack: ${projectStack}.`
        : `I'm ready to build ${projectName}. I understand this is a ${projectType} using ${projectStack}. Your goal is: ${projectDescription}`,
    },
  ]);

  const [message, setMessage] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "$ HexaWave Terminal",
    "Build output and workspace events will appear here.",
  ]);

  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("created");
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [isProjectMaintaining, setIsProjectMaintaining] = useState(false);
  const [projectTaskMode, setProjectTaskMode] = useState<"maintain" | "autonomous" | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [runUrl, setRunUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("fast");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activityView, setActivityView] = useState<ActivityView>("explorer");
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("Terminal");
  const [fileQuery, setFileQuery] = useState("");
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [frontendHosting, setFrontendHosting] = useState("Azure App Service");
  const [frontendLanguage, setFrontendLanguage] = useState("TypeScript");
  const [frontendFramework, setFrontendFramework] = useState("Next.js");
  const [customFrontendLanguage, setCustomFrontendLanguage] = useState("");
  const [customFrontendFramework, setCustomFrontendFramework] = useState("");
  const [backendHosting, setBackendHosting] = useState("Azure Container Apps");
  const [backendLanguage, setBackendLanguage] = useState("TypeScript");
  const [backendFramework, setBackendFramework] = useState("NestJS");
  const [customBackendLanguage, setCustomBackendLanguage] = useState("");
  const [customBackendFramework, setCustomBackendFramework] = useState("");
  const frontendFrameworkOptions = compatibleFrameworks(
    frontendFrameworks,
    frontendLanguage,
    frontendHosting,
  );
  const backendFrameworkOptions = compatibleFrameworks(
    backendFrameworks,
    backendLanguage,
    backendHosting,
  );
  const lastOutput = useRef("");
  const lastStatusError = useRef("");
  const filteredFiles = files.filter((file) => {
    const query = fileQuery.trim().toLowerCase();
    return (
      !query ||
      file.name.toLowerCase().includes(query) ||
      file.content?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    let active = true;

    async function checkAiHealth() {
      try {
        await getAiHealth();
        if (active) setAiOnline(true);
      } catch {
        if (active) setAiOnline(false);
      }
    }

    void checkAiHealth();
    const healthPoll = window.setInterval(() => {
      void checkAiHealth();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(healthPoll);
    };
  }, []);

  useEffect(() => {
    if (generationStartedAt === null) return;
    const updateElapsedTime = () => {
      setGenerationElapsedSeconds(
        Math.floor((Date.now() - generationStartedAt) / 1000),
      );
    };
    updateElapsedTime();
    const timer = window.setInterval(updateElapsedTime, 1000);
    return () => window.clearInterval(timer);
  }, [generationStartedAt]);

  useEffect(() => {
    if (!projectId) return;
    let active = true;

    async function loadWorkspace() {
      try {
        const status = await getProjectStatus(projectId);
        if (!active) return;
        setProjectStatus(status.status);
        if (status.process?.port) {
          setRunUrl(`http://localhost:${status.process.port}`);
        }
        if (status.output) {
          lastOutput.current = status.output;
          setTerminalLines((current) => [...current, ...status.output.split(/\r?\n/).filter(Boolean)]);
        }

        const paths = await getProjectFiles(projectId);
        const loaded: ApiProjectFile[] = await Promise.all(
          paths.map((path) => getProjectFile(projectId, path)),
        );
        if (!active) return;
        const workspaceFiles: ProjectFile[] = loaded.map((file) => ({
          ...file,
          type: "file",
        }));
        setFiles(workspaceFiles);
        setActiveFile((current) => current || workspaceFiles[0]?.name || "");
        setEditorContent((current) => current || workspaceFiles[0]?.content || "");
      } catch (error) {
        if (active) {
          setMessages((current) => [...current, {
            role: "assistant",
            text: error instanceof Error ? error.message : "Could not load the saved project.",
          }]);
        }
      }
    }

    void loadWorkspace();
    const poll = window.setInterval(() => {
      void getProjectStatus(projectId).then((status) => {
        if (!active) return;
        lastStatusError.current = "";
        setProjectStatus(status.status);
        if (status.process?.port) {
          setRunUrl(`http://localhost:${status.process.port}`);
        } else if (status.status !== "running") {
          setRunUrl("");
        }
        if (status.output) {
          const previous = lastOutput.current;
          const freshOutput = status.output.startsWith(previous)
            ? status.output.slice(previous.length)
            : status.output;
          lastOutput.current = status.output;
          const lines = freshOutput.split(/\r?\n/).filter(Boolean);
          if (lines.length) {
            setTerminalLines((current) => [...current.slice(-150), ...lines]);
          }
        }
      }).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown error";
        if (active && detail !== lastStatusError.current) {
          lastStatusError.current = detail;
          setTerminalLines((current) => [
            ...current.slice(-150),
            `✕ Status update failed: ${detail}`,
          ]);
        }
      });
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [projectId]);

  function openFile(file: ProjectFile) {
    if (file.type !== "file") return;

    setActiveFile(file.name);
    setEditorContent(file.content || "");
  }

  async function saveFile(): Promise<boolean> {
    if (!projectId || !activeFile) return true;
    if (isSaving) return false;
    setIsSaving(true);
    try {
      await updateProjectFile(projectId, activeFile, editorContent);
      setFiles((current) => current.map((file) =>
        file.name === activeFile ? { ...file, content: editorContent } : file
      ));
      setTerminalLines((current) => [...current, `✓ Saved ${activeFile}`]);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown save error";
      setTerminalLines((current) => [...current, `✕ Save failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `Save failed: ${detail}` }]);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function editCurrentFileWithAi() {
    const instruction = message.trim();
    if (
      !projectId ||
      !activeFile ||
      !instruction ||
      isAiEditing ||
      isProjectMaintaining ||
      isGenerating ||
      isBuilding ||
      runPending
    ) {
      return;
    }
    if (!aiOnline) {
      const detail = "AI service is offline. Start the AI service and check its configuration before requesting an edit.";
      setMessages((current) => [...current, { role: "assistant", text: detail }]);
      setTerminalLines((current) => [...current, `✕ ${detail}`]);
      return;
    }

    setIsAiEditing(true);
    setMessages((current) => [...current, { role: "user", text: `Edit ${activeFile}: ${instruction}` }]);
    setTerminalLines((current) => [...current, "", `$ hexawave ai-edit ${activeFile}`, "Applying AI edit..."]);
    try {
      await updateProjectFile(projectId, activeFile, editorContent);
      const edited = await editProjectFileWithAi(projectId, activeFile, instruction);
      setEditorContent(edited.content);
      setFiles((current) => current.map((file) =>
        file.name === edited.name ? { ...file, content: edited.content } : file
      ));
      setProjectStatus((current) => current === "running" ? current : "created");
      setMessage("");
      setTerminalLines((current) => [...current, `✓ AI updated ${edited.name}`, "Run Build to validate the edit."]);
      setMessages((current) => [...current, {
        role: "assistant",
        text: `Updated ${edited.name} with your instruction. Review the changes, then build the project to validate them.`,
      }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown AI edit error";
      setTerminalLines((current) => [...current, `✕ AI edit failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `AI edit failed: ${detail}` }]);
    } finally {
      setIsAiEditing(false);
    }
  }

  async function maintainProjectWithAiRequest() {
    const instruction = message.trim();
    if (
      !projectId ||
      !instruction ||
      isProjectMaintaining ||
      isAiEditing ||
      isGenerating ||
      isBuilding ||
      runPending
    ) {
      return;
    }
    if (!aiOnline) {
      const detail = "AI service is offline. Start the AI service and check its configuration before requesting project maintenance.";
      setMessages((current) => [...current, { role: "assistant", text: detail }]);
      setTerminalLines((current) => [...current, `✕ ${detail}`]);
      return;
    }

    setIsProjectMaintaining(true);
    setProjectTaskMode("maintain");
    setMessages((current) => [
      ...current,
      { role: "user", text: `Maintain the project: ${instruction}` },
    ]);
    setTerminalLines((current) => [
      ...current,
      "",
      "$ hexawave ai-maintain",
      "Reviewing safe project files and applying the requested changes...",
    ]);
    try {
      if (activeFile && !(await saveFile())) return;
      const result = await maintainProjectWithAi(projectId, instruction);
      const paths = await getProjectFiles(projectId);
      const loaded: ApiProjectFile[] = await Promise.all(
        paths.map((path) => getProjectFile(projectId, path)),
      );
      const refreshedFiles: ProjectFile[] = loaded.map((file) => ({
        ...file,
        type: "file",
      }));
      setFiles(refreshedFiles);
      const selected = refreshedFiles.find((file) => file.name === activeFile)
        ?? refreshedFiles[0];
      if (selected) {
        setActiveFile(selected.name);
        setEditorContent(selected.content || "");
      }
      setProjectStatus((current) => current === "running" ? current : "created");
      setMessage("");
      const changed = result.changedFiles.length
        ? result.changedFiles.join(", ")
        : "No files needed changes";
      const exclusions = result.excludedFileCount
        ? ` ${result.excludedFileCount} unsupported, oversized, or sensitive files were excluded from AI context.`
        : "";
      setTerminalLines((current) => [
        ...current,
        `✓ ${result.summary || "Project maintenance completed."}`,
        `Changed: ${changed}.${exclusions}`,
        "Review the files, then run Build to validate the project.",
      ]);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `${result.summary || "Project maintenance completed."} Changed: ${changed}.${exclusions} Review the files, then build the project to validate the changes.`,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown project maintenance error";
      setTerminalLines((current) => [...current, `✕ Project maintenance failed: ${detail}`]);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `Project maintenance failed: ${detail}` },
      ]);
    } finally {
      setIsProjectMaintaining(false);
      setProjectTaskMode(null);
    }
  }

  async function runAutonomousTask() {
    const instruction = message.trim();
    if (
      !projectId ||
      !instruction ||
      isProjectMaintaining ||
      isAiEditing ||
      isGenerating ||
      isBuilding ||
      runPending
    ) {
      return;
    }
    if (!aiOnline) {
      const detail = "AI service is offline. Start the AI service before requesting an autonomous task.";
      setMessages((current) => [...current, { role: "assistant", text: detail }]);
      setTerminalLines((current) => [...current, `✕ ${detail}`]);
      return;
    }

    setIsProjectMaintaining(true);
    setProjectTaskMode("autonomous");
    setMessages((current) => [
      ...current,
      { role: "user", text: `Run autonomously: ${instruction}` },
    ]);
    setTerminalLines((current) => [
      ...current,
      "",
      "$ hexawave autonomous",
      "Planning changes, editing safe project files, running checks, and allowing up to 3 repair attempts...",
    ]);
    try {
      if (activeFile && !(await saveFile())) return;
      const result = await runAutonomousProjectTask(projectId, instruction);
      const paths = await getProjectFiles(projectId);
      const loaded: ApiProjectFile[] = await Promise.all(
        paths.map((path) => getProjectFile(projectId, path)),
      );
      const refreshedFiles: ProjectFile[] = loaded.map((file) => ({
        ...file,
        type: "file",
      }));
      setFiles(refreshedFiles);
      const selected = refreshedFiles.find((file) => file.name === activeFile)
        ?? refreshedFiles[0];
      if (selected) {
        setActiveFile(selected.name);
        setEditorContent(selected.content || "");
      }
      setProjectStatus(result.success ? "ready" : "failed");
      setMessage("");

      const changed = result.changedFiles.length
        ? result.changedFiles.join(", ")
        : "No files changed";
      const outcome = result.success
        ? "All available checks passed."
        : `Checks did not pass after ${result.build.attempts} repair attempt(s).`;
      const diagnostics = [
        ...result.test.errors,
        ...result.runtimeTests.errors,
        ...result.build.errors,
      ].slice(0, 5);
      const exclusions = result.excludedFileCount
        ? ` ${result.excludedFileCount} unsupported, oversized, or sensitive files were excluded from AI context.`
        : "";
      setTerminalLines((current) => [
        ...current,
        `${result.success ? "✓" : "⚠"} ${result.summary || "Autonomous task finished."}`,
        `Changed: ${changed}.`,
        `Static checks: ${result.test.passed ? "passed" : "failed"}; project tests: ${result.runtimeTests.skipped ? "skipped" : result.runtimeTests.passed ? "passed" : "failed"}; build: ${result.build.passed ? "passed" : "failed"}. ${outcome}${exclusions}`,
        ...diagnostics.map((diagnostic) => `  ${diagnostic}`),
        "Review the changed files. Deployment, production changes, and trading still require separate approval.",
      ]);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `${result.summary || "Autonomous task finished."} Changed: ${changed}. Static checks ${result.test.passed ? "passed" : "failed"}; project tests ${result.runtimeTests.skipped ? "were skipped" : result.runtimeTests.passed ? "passed" : "failed"}; build ${result.build.passed ? "passed" : "failed"} after ${result.build.attempts} repair attempt(s).${exclusions} Review the files before requesting any external action.`,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown autonomous task error";
      setProjectStatus("failed");
      setTerminalLines((current) => [...current, `✕ Autonomous task failed: ${detail}`]);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `Autonomous task failed: ${detail}` },
      ]);
    } finally {
      setIsProjectMaintaining(false);
      setProjectTaskMode(null);
    }
  }

  async function runProject() {
    if (!projectId || runPending || projectStatus === "running" || isBuilding || isGenerating || isProjectMaintaining) return;
    setRunPending(true);
    setTerminalLines((current) => [...current, "", "$ hexawave run", "Installing dependencies if needed..."]);
    try {
      const result = await runProjectFromApi(projectId);
      if (!result.success || !result.url) {
        throw new Error(result.message || result.stderr || "Application did not start.");
      }
      setProjectStatus("running");
      setRunUrl(result.url);
      setTerminalLines((current) => [
        ...current,
        "✓ Application running",
        `Preview: ${result.url}`,
      ]);
      setMessages((current) => [...current, {
        role: "assistant",
        text: `Your application is running at ${result.url}`,
      }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown run error";
      setProjectStatus("failed");
      setTerminalLines((current) => [...current, `✕ Run failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `Run failed: ${detail}` }]);
    } finally {
      setRunPending(false);
    }
  }

  async function stopRunningProject() {
    if (!projectId || projectStatus !== "running") return;
    setTerminalLines((current) => [...current, "", "$ hexawave stop"]);
    try {
      const result = await stopProjectFromApi(projectId);
      if (!result.success) throw new Error(result.message || "Could not stop the process.");
      setProjectStatus("stopped");
      setRunUrl("");
      setTerminalLines((current) => [...current, "✓ Application stopped"]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown stop error";
      setTerminalLines((current) => [...current, `✕ Stop failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `Stop failed: ${detail}` }]);
    }
  }

  async function buildProject() {
    if (!projectId || isBuilding || isGenerating || runPending || isProjectMaintaining) return;
    setIsBuilding(true);
    setProjectStatus("building");
    setTerminalLines((current) => [...current, "", "$ hexawave build", "Testing project files...", "Building..."]);
    try {
      const result = await buildProjectFromApi(projectId);
      if (!result.success) {
        const errors = [
          result.message,
          result.build?.stderr,
          result.build?.stdout,
          ...(result.build?.errors || []),
        ].filter(Boolean).join("\n");
        throw new Error(errors || "Build failed without diagnostic output.");
      }
      setProjectStatus("ready");
      setTerminalLines((current) => [...current, "✓ Tests passed", "✓ Build successful"]);
      if ((result.attempts ?? 0) > 0) {
        setTerminalLines((current) => [...current, `✓ AI repair completed in ${result.attempts} attempt(s)`]);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown build error";
      setProjectStatus("failed");
      setTerminalLines((current) => [...current, `✕ Build failed\n${detail}`]);
      setMessages((current) => [...current, {
        role: "assistant",
        text: `Build failed. The build output is shown in the terminal.\n\n${detail}`,
      }]);
    } finally {
      setIsBuilding(false);
    }
  }

  function sendMessage() {
    const value = message.trim();
    if (value) void generateProject(value);
  }

  async function generateProject(requestOverride?: string) {
    const request = requestOverride ?? message.trim();
    if (!request || isGenerating || isBuilding || runPending || isProjectMaintaining) return;

    const chosenFrontendLanguage =
      frontendLanguage === "Other / custom"
        ? customFrontendLanguage.trim() || "Custom frontend language"
        : frontendLanguage;
    const chosenFrontendFramework =
      frontendFramework === "Other / custom"
        ? customFrontendFramework.trim() || "Custom frontend framework"
        : frontendFramework;
    const chosenBackendLanguage =
      backendLanguage === "Other / custom"
        ? customBackendLanguage.trim() || "Custom backend language"
        : backendLanguage;
    const chosenBackendFramework =
      backendFramework === "Other / custom"
        ? customBackendFramework.trim() || "Custom backend framework"
        : backendFramework;
    const chosenStack = [
      `Frontend: ${chosenFrontendFramework} (${chosenFrontendLanguage}) hosted on ${frontendHosting}`,
      `Backend: ${chosenBackendFramework} (${chosenBackendLanguage}) hosted on ${backendHosting}`,
    ].join("; ");

    setIsGenerating(true);
    setGenerationStartedAt(Date.now());
    setProjectStatus("planning");
    setMessages((current) => [...current, { role: "user", text: request }]);
    setMessages((current) => [...current, {
      role: "assistant",
      text: generationMode === "fast"
        ? "Fast generation is on: planning and architecture are combined into one design pass. Code generation, tests, build, and bounded AI repair still run."
        : "Full design is on: planning and architecture run as separate stages, followed by code generation, tests, build, and bounded AI repair.",
    }]);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: `Selected architecture: ${chosenStack}.`,
      },
    ]);
    setTerminalLines((current) => [
      ...current,
      "",
      "$ hexawave build",
      generationMode === "fast" ? "Fast design pass..." : "Planning...",
    ]);
    setMessage("");

    try {
      let id = projectId;
      if (!id) {
        const created = await createProjectFromApi({
          name: projectName,
          type: projectType,
          stack: chosenStack,
          description: projectDescription,
        });
        id = created.project.id;
        setProjectId(id);
        const query = new URLSearchParams({
          project: projectName,
          type: projectType,
          stack: chosenStack,
          description: projectDescription,
          id,
        });
        router.replace(`/ai-developer?${query.toString()}`);
      }

      const result = await generateProjectFromApi({
        projectName,
        projectType,
        stack: chosenStack,
        prompt: request,
        generationMode,
      }, id);
      if (!result.success) {
        const detail = [
          result.build?.errors.join("\n"),
          result.build?.stderr,
          result.build?.stdout,
        ].filter(Boolean).join("\n");
        throw new Error(detail || "Generation or project validation failed.");
      }

      const generated = result.files;
      const generatedFiles: ProjectFile[] = generated.map((file) => ({
        ...file,
        type: "file",
      }));
      setFiles(generatedFiles);
      if (generatedFiles[0]) {
        setActiveFile(generatedFiles[0].name);
        setEditorContent(generatedFiles[0].content || "");
      }
      setProjectStatus("ready");
      setTerminalLines((current) => [
        ...current,
        generationMode === "fast"
          ? "✓ Fast planning and architecture complete (one AI design pass)"
          : "✓ Planning complete",
        ...(generationMode === "full" ? ["✓ Architecture complete"] : []),
        `✓ ${generatedFiles.length} files generated`,
        "✓ Tests passed",
        "✓ Build successful",
      ]);
      setMessages((current) => [...current, {
        role: "assistant",
        text: `Project generation completed in ${generationMode} mode. ${generatedFiles.length} files were persisted to workspace ${id}. The generated project passed tests and build validation.`,
      }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown generation error";
      setProjectStatus("failed");
      setTerminalLines((current) => [...current, `✕ Generation failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `Generation failed: ${detail}` }]);
    } finally {
      setIsGenerating(false);
      setGenerationStartedAt(null);
    }
  }

  async function downloadProject() {
    if (!projectId || isDownloading) return;
    setIsDownloading(true);
    try {
      if (activeFile) {
        await updateProjectFile(projectId, activeFile, editorContent);
        setFiles((current) => current.map((file) =>
          file.name === activeFile ? { ...file, content: editorContent } : file
        ));
        setTerminalLines((current) => [...current, `✓ Saved editor changes for ${activeFile}`]);
      }
      await downloadWorkspaceZip(projectId);
      setTerminalLines((current) => [...current, "✓ Downloaded complete workspace ZIP"]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown download error";
      setTerminalLines((current) => [...current, `✕ Download failed: ${detail}`]);
      setMessages((current) => [...current, { role: "assistant", text: `Download failed: ${detail}` }]);
    } finally {
      setIsDownloading(false);
    }
  }

  function statusLabel(): string {
    if (runPending) return "Starting";
    if (projectStatus === "failed") return "Error";
    return projectStatus.charAt(0).toUpperCase() + projectStatus.slice(1);
  }

  function addFile() {
    const fileName = window.prompt("Enter a new relative file name", "new-component.tsx");
    if (!fileName?.trim() || !projectId) return;
    const normalizedName = fileName.trim().replace(/\\/g, "/");
    if (
      normalizedName.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalizedName) ||
      normalizedName.split("/").includes("..")
    ) {
      setMessages((current) => [...current, {
        role: "assistant",
        text: "File name must be a relative path inside the project workspace.",
      }]);
      return;
    }
    const newFile: ProjectFile = {
      name: normalizedName,
      type: "file",
      language: getLanguage(normalizedName),
      content: "",
    };
    setFiles((current) => [...current, newFile]);
    setActiveFile(newFile.name);
    setEditorContent("");
    void updateProjectFile(projectId, newFile.name, "").catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "Unknown file error";
      setTerminalLines((current) => [...current, `✕ Could not create file: ${detail}`]);
    });
  }

  function getLanguage(path: string): string {
    const extension = path.split(".").pop()?.toLowerCase();
    if (extension === "json") return "json";
    if (extension === "tsx") return "tsx";
    if (extension === "ts") return "typescript";
    if (extension === "md") return "markdown";
    if (extension === "py") return "python";
    return extension || "text";
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

          <span className="max-w-40 truncate text-[11px] text-white/45">
            {projectName}
          </span>
        </div>

        <div className="flex items-center gap-3 px-3">
          <Link
            href="/workspace"
            className="text-[10px] text-white/45 transition hover:text-white"
          >
            Workspace
          </Link>
          <Link
            href="/projects/new"
            className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-white/60 transition hover:bg-white/[0.05] hover:text-white"
          >
            New project
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${
              aiOnline === true ? "bg-emerald-400"
                : aiOnline === false ? "bg-red-400"
                  : "animate-pulse bg-white/35"
            }`} />
            <span className={`text-[10px] ${
              aiOnline === true ? "text-emerald-300/70"
                : aiOnline === false ? "text-red-300/70"
                  : "text-white/35"
            }`}>
              {aiOnline === true ? "AI Online" : aiOnline === false ? "AI Offline" : "Checking AI"}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${
              projectStatus === "ready" ? "bg-emerald-400"
                : projectStatus === "running" ? "bg-cyan-300"
                  : projectStatus === "failed" ? "bg-red-400"
                    : isGenerating || isBuilding || runPending ? "animate-pulse bg-amber-300"
                      : "bg-white/30"
            }`} />
            <span className="text-[10px] text-white/60">{statusLabel()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2">
          <button
            onClick={saveFile}
            disabled={!projectId || !activeFile || isSaving || isDownloading || isAiEditing || isProjectMaintaining}
            className="rounded-md px-3 py-1.5 text-[10px] text-white/45 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={buildProject}
            disabled={!projectId || isBuilding || isGenerating || runPending || isProjectMaintaining}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/55 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Rocket size={12} />
            {isBuilding ? "Building..." : "Build"}
          </button>

          <button
            onClick={projectStatus === "running" ? stopRunningProject : runProject}
            disabled={!projectId || runPending || isGenerating || isBuilding || isProjectMaintaining}
            className="flex items-center gap-1.5 rounded-md bg-cyan-300 px-3 py-1.5 text-[10px] font-bold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {projectStatus === "running" ? <Square size={11} /> : <Play size={11} />}
            {runPending ? "Starting..." : projectStatus === "running" ? "Stop" : "Run"}
          </button>

          <button
            onClick={downloadProject}
            disabled={!projectId || isDownloading || isSaving || isAiEditing || isProjectMaintaining}
            title="Save editor changes and download the complete project ZIP"
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-2 text-[10px] text-white/55 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Download size={13} />
            <span>{isDownloading ? "Preparing..." : "Download ZIP"}</span>
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">

        <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/[0.07] bg-[#090b10] py-3">

          {[
            {
              label: "Explorer",
              icon: Folder,
              active: explorerOpen && activityView === "explorer",
              action: () => {
                setActivityView("explorer");
                setExplorerOpen(true);
              },
            },
            {
              label: "Search files",
              icon: Search,
              active: explorerOpen && activityView === "search",
              action: () => {
                setActivityView("search");
                setExplorerOpen(true);
              },
            },
            {
              label: aiPanelOpen ? "Hide AI assistant" : "Show AI assistant",
              icon: Bot,
              active: aiPanelOpen,
              action: () => setAiPanelOpen((open) => !open),
            },
            {
              label: projectStatus === "running" ? "Stop app" : "Run app",
              icon: projectStatus === "running" ? Square : Rocket,
              active: projectStatus === "running",
              action: () =>
                void (projectStatus === "running"
                  ? stopRunningProject()
                  : runProject()),
            },
          ].map(({ label, icon: Icon, active, action }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={action}
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg transition ${
                active
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
                {activityView === "search" ? "Search in files" : "Explorer"}
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
              {activityView === "search" && (
                <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-2">
                  <Search size={12} className="shrink-0 text-white/35" />
                  <input
                    aria-label="Search project files"
                    value={fileQuery}
                    onChange={(event) => setFileQuery(event.target.value)}
                    placeholder="Search names and contents"
                    className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/25"
                  />
                </label>
              )}

              <div className="mb-2 flex items-center gap-1 px-2 text-[10px] font-semibold text-white/55">
                <ChevronDown size={13} />
                {projectName.toUpperCase()}
              </div>

              <div className="ml-2 space-y-0.5">

                {filteredFiles.map((file) => (
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
                {files.length === 0 && (
                  <div className="px-2 py-2 text-[10px] text-white/25">
                    {projectId ? "Loading workspace files..." : "Generate a project to create files."}
                  </div>
                )}
                {files.length > 0 && filteredFiles.length === 0 && (
                  <div className="px-2 py-2 text-[10px] text-white/35">
                    No files match “{fileQuery}”.
                  </div>
                )}

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

            <div className="flex min-w-0 items-center gap-2 border-r border-white/[0.07] bg-[#10131a] px-4">
              <FileCode2 size={13} className="text-cyan-300/70" />
              <span className="max-w-48 truncate text-[10px] text-white/65">
                {activeFile}
              </span>
              {activeFile && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFile("");
                    setEditorContent("");
                  }}
                  aria-label="Close active file"
                  className="ml-1 text-white/30 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            {activeFile && (
              <button
                onClick={() => void editCurrentFileWithAi()}
                disabled={!projectId || !message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                title="Apply your AI instruction to the open file"
                className="ml-auto mr-2 flex items-center gap-1.5 rounded-md px-2.5 text-[9px] font-semibold text-cyan-200/75 hover:bg-cyan-300/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Sparkles size={12} />
                {isAiEditing ? "Editing..." : "AI edit"}
              </button>
            )}
            {projectId && (
              <button
                onClick={() => void maintainProjectWithAiRequest()}
                disabled={!message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                title="Apply your instruction across the project files"
                className={`${activeFile ? "" : "ml-auto"} mr-2 flex items-center gap-1.5 rounded-md border border-violet-300/15 px-2.5 text-[9px] font-semibold text-violet-200/80 hover:bg-violet-300/10 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-30`}
              >
                <Sparkles size={12} />
                {projectTaskMode === "maintain" ? "Maintaining..." : "Maintain project"}
              </button>
            )}
            {projectId && (
              <button
                onClick={() => void runAutonomousTask()}
                disabled={!message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                title="Let AI edit, test, build, and attempt up to three repairs"
                className="mr-2 flex items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-2.5 text-[9px] font-semibold text-emerald-200/85 hover:bg-emerald-300/10 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Zap size={12} />
                {projectTaskMode === "autonomous" ? "Working..." : "Autonomous"}
              </button>
            )}
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col bg-[#080a0f]">

            {files.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-5 py-8">
                <div className="w-full max-w-3xl">
                  <div className="mb-7 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200">
                      <Sparkles size={21} />
                    </div>
                    <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                      AI build studio
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      Build {projectName}
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-white/45">
                      Describe what you want in plain language. Fast mode uses
                      one design pass; generation and validation time depends
                      on your AI provider and project complexity.
                    </p>
                  </div>

                  <div className="block rounded-2xl border border-white/[0.1] bg-[#0d1119] p-3 shadow-xl shadow-black/20 focus-within:border-cyan-300/30">
                    <span className="sr-only">Describe the software to generate</span>
                    <textarea
                      aria-label="Describe the software to generate"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      rows={4}
                      placeholder="What should this app do? Describe the users, key screens, and the most important features..."
                      className="w-full resize-y bg-transparent px-2 py-2 text-sm leading-6 text-white/85 outline-none placeholder:text-white/25"
                    />
                    <div className="grid gap-4 border-t border-white/[0.06] py-4 md:grid-cols-2">
                      <fieldset className="min-w-0 space-y-3">
                        <legend className="mb-2 text-xs font-semibold text-cyan-100">
                          Frontend stack
                        </legend>
                        <label className="block text-[10px] text-white/45">
                          Hosting
                          <select
                            value={frontendHosting}
                            onChange={(event) => {
                              const host = event.target.value;
                              const nextOptions = compatibleFrameworks(
                                frontendFrameworks,
                                frontendLanguage,
                                host,
                              );
                              setFrontendHosting(host);
                              setFrontendFramework(
                                nextOptions[0]?.name ?? "Other / custom",
                              );
                            }}
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {frontendHostingOptions.map((host) => (
                              <option key={host}>{host}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[10px] text-white/45">
                          Language
                          <select
                            value={frontendLanguage}
                            onChange={(event) => {
                              const language = event.target.value;
                              const nextOptions = compatibleFrameworks(
                                frontendFrameworks,
                                language,
                                frontendHosting,
                              );
                              setFrontendLanguage(language);
                              setFrontendFramework(
                                nextOptions[0]?.name ?? "Other / custom",
                              );
                            }}
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {frontendLanguages.map((language) => (
                              <option key={language}>{language}</option>
                            ))}
                          </select>
                        </label>
                        {frontendLanguage === "Other / custom" && (
                          <input
                            aria-label="Custom frontend language"
                            value={customFrontendLanguage}
                            onChange={(event) =>
                              setCustomFrontendLanguage(event.target.value)
                            }
                            placeholder="Enter any frontend language"
                            className="w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white placeholder:text-white/25"
                          />
                        )}
                        <label className="block text-[10px] text-white/45">
                          Framework
                          <select
                            value={frontendFramework}
                            onChange={(event) =>
                              setFrontendFramework(event.target.value)
                            }
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {frontendFrameworkOptions.map((framework) => (
                              <option key={framework.name}>
                                {framework.name}
                              </option>
                            ))}
                            <option>Other / custom</option>
                          </select>
                        </label>
                        {frontendFramework === "Other / custom" && (
                          <input
                            aria-label="Custom frontend framework"
                            value={customFrontendFramework}
                            onChange={(event) =>
                              setCustomFrontendFramework(event.target.value)
                            }
                            placeholder="Enter any frontend framework"
                            className="w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white placeholder:text-white/25"
                          />
                        )}
                      </fieldset>
                      <fieldset className="min-w-0 space-y-3">
                        <legend className="mb-2 text-xs font-semibold text-cyan-100">
                          Backend stack
                        </legend>
                        <label className="block text-[10px] text-white/45">
                          Hosting
                          <select
                            value={backendHosting}
                            onChange={(event) => {
                              const host = event.target.value;
                              const nextOptions = compatibleFrameworks(
                                backendFrameworks,
                                backendLanguage,
                                host,
                              );
                              setBackendHosting(host);
                              setBackendFramework(
                                nextOptions[0]?.name ?? "Other / custom",
                              );
                            }}
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {backendHostingOptions.map((host) => (
                              <option key={host}>{host}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[10px] text-white/45">
                          Language
                          <select
                            value={backendLanguage}
                            onChange={(event) => {
                              const language = event.target.value;
                              const nextOptions = compatibleFrameworks(
                                backendFrameworks,
                                language,
                                backendHosting,
                              );
                              setBackendLanguage(language);
                              setBackendFramework(
                                nextOptions[0]?.name ?? "Other / custom",
                              );
                            }}
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {backendLanguages.map((language) => (
                              <option key={language}>{language}</option>
                            ))}
                          </select>
                        </label>
                        {backendLanguage === "Other / custom" && (
                          <input
                            aria-label="Custom backend language"
                            value={customBackendLanguage}
                            onChange={(event) =>
                              setCustomBackendLanguage(event.target.value)
                            }
                            placeholder="Enter any backend language"
                            className="w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white placeholder:text-white/25"
                          />
                        )}
                        <label className="block text-[10px] text-white/45">
                          Framework
                          <select
                            value={backendFramework}
                            onChange={(event) =>
                              setBackendFramework(event.target.value)
                            }
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white"
                          >
                            {backendFrameworkOptions.map((framework) => (
                              <option key={framework.name}>
                                {framework.name}
                              </option>
                            ))}
                            <option>Other / custom</option>
                          </select>
                        </label>
                        {backendFramework === "Other / custom" && (
                          <input
                            aria-label="Custom backend framework"
                            value={customBackendFramework}
                            onChange={(event) =>
                              setCustomBackendFramework(event.target.value)
                            }
                            placeholder="Enter any backend framework"
                            className="w-full rounded-lg border border-white/10 bg-[#090c12] px-3 py-2 text-xs text-white placeholder:text-white/25"
                          />
                        )}
                      </fieldset>
                    </div>
                    <p className="pb-3 text-[10px] leading-5 text-white/35">
                      Hosting choices guide generated architecture; this does
                      not deploy the app. Built-in build/run validation currently
                      supports Node/npm and Python projects only. Use custom
                      fields for other languages or frameworks.
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-2 pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <span>Generation</span>
                        {(["fast", "full"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setGenerationMode(mode)}
                            disabled={isGenerating || isBuilding || runPending}
                            className={`rounded-md px-2.5 py-1.5 transition ${
                              generationMode === mode
                                ? "bg-cyan-300/10 text-cyan-100"
                                : "text-white/45 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            {mode === "fast" ? "⚡ Fast" : "Full design"}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => void generateProject()}
                        disabled={!message.trim() || isGenerating || isBuilding || runPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isGenerating ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
                            Generating
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            Generate project
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isGenerating && (
                    <div
                      className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-100/70"
                      role="status"
                      aria-live="polite"
                    >
                      <Clock3 size={13} />
                      Generating files and running validation ·{" "}
                      {Math.floor(generationElapsedSeconds / 60)
                        .toString()
                        .padStart(2, "0")}
                      :{(generationElapsedSeconds % 60).toString().padStart(2, "0")} elapsed
                    </div>
                  )}

                  <div className="mt-7">
                    <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
                      Start from an idea
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {quickStarts.map((item) => (
                        <button
                          key={item.title}
                          type="button"
                          disabled={isGenerating || isBuilding || runPending}
                          onClick={() => void generateProject(item.prompt)}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04] disabled:opacity-40"
                        >
                          <span className="block text-xs font-semibold text-white/75">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-[10px] leading-4 text-white/40">
                            {item.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {projectStatus === "failed" && (
                    <p
                      className="mt-4 text-center text-xs text-rose-200/80"
                      role="alert"
                    >
                      Generation failed. See the terminal or AI panel for details,
                      then update your prompt and retry.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                disabled={!activeFile || isProjectMaintaining}
                placeholder={activeFile ? "" : "Select or generate a project file to edit"}
                className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[12px] leading-6 text-white/75 outline-none"
              />

            </div>

            <div className="flex h-8 shrink-0 items-center border-t border-white/[0.06] bg-[#0b0e14] px-3 text-[9px] text-white/30">
              <span>{activeFile}</span>
              <span className="mx-2 text-white/10">•</span>
              <span>UTF-8</span>
              <span className="mx-2 text-white/10">•</span>
              <span>{getLanguage(activeFile)}</span>

              <span className={`ml-auto flex items-center gap-1 ${
                projectStatus === "failed" ? "text-red-300/80"
                  : projectStatus === "running" ? "text-cyan-300/80"
                    : "text-emerald-300/70"
              }`}>
                <Activity size={10} />
                {statusLabel()}
              </span>
            </div>
              </>
            )}
          </div>

          <div className="h-52 shrink-0 border-t border-white/[0.07] bg-[#07090d]">

            <div className="flex h-9 items-center gap-5 border-b border-white/[0.06] px-4">
              {(["Terminal", "Problems", "Output"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setConsoleTab(tab)}
                  className={`flex h-full items-center gap-1.5 border-b px-1 text-[9px] font-bold uppercase tracking-wider ${
                    consoleTab === tab
                      ? "border-cyan-300/60 text-white/70"
                      : "border-transparent text-white/30 hover:text-white/55"
                  }`}
                >
                  {tab === "Terminal" && <Terminal size={12} />}
                  {tab}
                  {tab === "Problems" && (
                    <span className="rounded-full bg-rose-300/10 px-1.5 py-0.5 text-[8px] text-rose-200/70">
                      {terminalLines.filter((line) => /✕|failed|Error/i.test(line)).length}
                    </span>
                  )}
                </button>
              ))}
              {runUrl && (
                <div className="ml-auto flex items-center gap-2 text-[9px] text-cyan-200/70">
                  Running on {runUrl}
                  <a href={runUrl} target="_blank" rel="noreferrer" className="hover:text-cyan-100">
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>

            <div className="h-[calc(100%-36px)] overflow-auto p-3 font-mono text-[10px] leading-5">
              {terminalLines
                .filter((line) =>
                  consoleTab === "Problems"
                    ? /✕|failed|Error/i.test(line)
                    : consoleTab === "Output"
                      ? !line.startsWith("$")
                      : true,
                )
                .map((line, index) => (
                <div
                  key={index}
                  className={
                    line.includes("✓")
                      ? "text-emerald-300/80"
                      : line.includes("✕") || line.includes("failed") || line.includes("Error")
                        ? "text-red-300/80"
                      : line.startsWith("$")
                        ? "text-cyan-300/80"
                        : "text-white/35"
                  }
                >
                  {line || "\u00A0"}
                </div>
              ))}
              {consoleTab === "Problems" &&
                !terminalLines.some((line) => /✕|failed|Error/i.test(line)) && (
                  <p className="text-[10px] text-white/35">No problems reported.</p>
                )}
            </div>
          </div>
        </section>

        {aiPanelOpen && (
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

            <div className={`ml-auto flex items-center gap-1 text-[8px] ${
              aiOnline === true ? "text-emerald-300/70"
                : aiOnline === false ? "text-red-300/70"
                  : "text-white/35"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                aiOnline === true ? "bg-emerald-400"
                  : aiOnline === false ? "bg-red-400"
                    : "animate-pulse bg-white/35"
              }`} />
              {aiOnline === true ? "Online" : aiOnline === false ? "Offline" : "Checking"}
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

              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="text-[8px] uppercase tracking-[0.14em] text-white/30">
                  Generation mode
                </span>
                <div className="flex rounded-md border border-white/[0.08] p-0.5">
                  {(["fast", "full"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGenerationMode(mode)}
                      disabled={isGenerating || isBuilding || runPending}
                      title={mode === "fast"
                        ? "One AI design pass for planning and architecture"
                        : "Separate planner and architect AI passes"}
                      className={`rounded px-2 py-1 text-[8px] capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        generationMode === mode
                          ? "bg-cyan-300/15 text-cyan-200"
                          : "text-white/35 hover:text-white/70"
                      }`}
                    >
                      {mode === "fast" ? "⚡ Fast" : "Full design"}
                    </button>
                  ))}
                </div>
              </div>

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
                placeholder="Describe a feature or maintenance task. Choose Autonomous to edit, test, build, and attempt bounded repairs."
                className="w-full resize-none bg-transparent px-2 py-1 text-[10px] leading-5 text-white outline-none placeholder:text-white/20"
              />

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[8px] text-white/20">
                  Enter to send
                </div>

                <button
                  onClick={() => void generateProject()}
                  disabled={isGenerating || isBuilding || runPending}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300 text-black transition hover:bg-cyan-200"
                >
                  {
  isGenerating ? (
    <span className="text-[9px] font-bold">AI</span>
  ) : (
    <Send size={12} />
  )
}
                </button>
                {activeFile && (
                  <button
                    onClick={() => void editCurrentFileWithAi()}
                    disabled={!projectId || !message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                    title={`AI edit ${activeFile}`}
                    className="ml-2 flex h-7 items-center gap-1 rounded-lg border border-cyan-300/20 px-2 text-[8px] font-semibold text-cyan-200/80 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Sparkles size={10} />
                    {isAiEditing ? "Editing" : "Open file"}
                  </button>
                )}
                {projectId && (
                  <button
                    onClick={() => void maintainProjectWithAiRequest()}
                    disabled={!message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                    title="Apply this instruction across the project"
                    className="ml-2 flex h-7 items-center gap-1 rounded-lg border border-violet-300/20 px-2 text-[8px] font-semibold text-violet-200/80 transition hover:bg-violet-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Sparkles size={10} />
                    {projectTaskMode === "maintain" ? "Maintaining" : "Maintain"}
                  </button>
                )}
                {projectId && (
                  <button
                    onClick={() => void runAutonomousTask()}
                    disabled={!message.trim() || aiOnline !== true || isAiEditing || isProjectMaintaining || isGenerating || isBuilding || runPending}
                    title="Let AI edit, test, build, and attempt up to three repairs"
                    className="ml-2 flex h-7 items-center gap-1 rounded-lg border border-emerald-300/20 px-2 text-[8px] font-semibold text-emerald-200/85 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Zap size={10} />
                    {projectTaskMode === "autonomous" ? "Working" : "Autonomous"}
                  </button>
                )}
              </div>

            </div>
          </div>
        </aside>
        )}
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
                {runUrl || "No running preview"}
              </div>

              <button
                onClick={() => setPreview(false)}
                className="text-white/30 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {runUrl ? (
              <iframe
                title={`${projectName} preview`}
                src={runUrl}
                className="flex-1 border-0 bg-white"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[#080a0f] text-center">
                <div>
                  <h2 className="text-lg font-semibold text-white/80">
                    No application is running
                  </h2>
                  <p className="mt-2 text-xs text-white/40">
                    Run the generated project to open its live preview here.
                  </p>
                  <button
                    onClick={() => {
                      setPreview(false);
                      void runProject();
                    }}
                    disabled={!projectId || runPending}
                    className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
                  >
                    Run Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setPreview(true)}
        disabled={!projectId}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-[10px] font-bold text-cyan-200 shadow-xl backdrop-blur-xl hover:bg-cyan-300/20 disabled:opacity-40"
      >
        <Globe size={13} />
        Preview
      </button>
    </main>
  );
}

export default function AIDeveloperPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-[#080a0f] text-xs text-white/45">
          Loading HexaWave IDE...
        </main>
      }
    >
      <AIDeveloperWorkspace />
    </Suspense>
  );
}
