"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Code2,
  FolderKanban,
  LogOut,
  Plus,
  Rocket,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  getCurrentUser,
  getCrmStats,
  getEmailIntegrationStatus,
  getLeadDiscoveryStatus,
  getProjects,
  logout,
  type AuthUser,
  type ProjectStatus,
  type ProjectSummary,
} from "@/lib/api";
import type {
  CrmStats,
  EmailIntegrationStatus,
  LeadDiscoveryStatus,
} from "@/src/types/crm";

const workspaceLinks: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: Activity, label: "Overview", href: "/dashboard" },
  { icon: FolderKanban, label: "Projects", href: "/workspace" },
  { icon: Bot, label: "AI Developer", href: "/ai-developer" },
  { icon: Shield, label: "Universal King", href: "/king" },
  { icon: Rocket, label: "Deployments", href: "/workspace" },
];

const activeStatuses = new Set<ProjectStatus>([
  "planning",
  "architecting",
  "coding",
  "testing",
  "building",
  "fixing",
]);

function formatStatus(status: ProjectStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [crmStats, setCrmStats] = useState<CrmStats | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<LeadDiscoveryStatus | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailIntegrationStatus | null>(null);
  const [salesError, setSalesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function signOut() {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  useEffect(() => {
    let active = true;

    void Promise.all([getCurrentUser(), getProjects()])
      .then(([currentUser, items]) => {
        if (!active) return;
        setUser(currentUser);
        setProjects(items);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load projects.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const requests = Promise.allSettled([
      getCrmStats(),
      getLeadDiscoveryStatus(),
      getEmailIntegrationStatus(),
    ]);

    void requests.then(([statsResult, discoveryResult, emailResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (statsResult.status === "fulfilled") {
        setCrmStats(statsResult.value);
      } else {
        errors.push("CRM metrics could not be loaded.");
      }
      if (discoveryResult.status === "fulfilled") {
        setDiscoveryStatus(discoveryResult.value);
      } else {
        errors.push("Lead discovery status could not be loaded.");
      }
      if (emailResult.status === "fulfilled") {
        setEmailStatus(emailResult.value);
      } else {
        errors.push("Email integration status could not be loaded.");
      }
      setSalesError(errors.join(" "));
    });

    return () => {
      active = false;
    };
  }, []);

  const dashboardStats = useMemo(() => [
    {
      label: "Projects",
      value: loading || loadError ? "—" : String(projects.length),
      icon: FolderKanban,
    },
    {
      label: "In progress",
      value: loading || loadError
        ? "—"
        : String(projects.filter((project) => activeStatuses.has(project.status)).length),
      icon: Bot,
    },
    {
      label: "Ready",
      value: loading || loadError
        ? "—"
        : String(projects.filter((project) => project.status === "ready").length),
      icon: Rocket,
    },
    {
      label: "Needs attention",
      value: loading || loadError
        ? "—"
        : String(projects.filter((project) => project.status === "failed").length),
      icon: Activity,
    },
  ], [loadError, loading, projects]);

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="flex min-h-screen">

        <aside className="hidden w-64 border-r border-white/[0.07] bg-[#080a10] p-4 lg:block">

          <div className="mb-9 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600">
              <Sparkles size={17} />
            </div>

            <div>
              <div className="text-sm font-bold">
                Hexa<span className="text-cyan-300">Wave</span>
              </div>

              <div className="text-[8px] uppercase tracking-[0.2em] text-white/30">
                AI Software Factory
              </div>
            </div>
          </div>

          <div className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
            Workspace
          </div>

          {workspaceLinks
            .filter(({ href }) => href !== "/king" || user?.role === "admin")
            .map(({ icon: Icon, label, href }, index) => (
            <Link
              key={label}
              href={href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs ${
                index === 0
                  ? "bg-cyan-400/10 text-cyan-300"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
            ))}
        </aside>

        <section className="min-w-0 flex-1">

          <header className="flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#080a10]/80 px-5 backdrop-blur-xl lg:px-8">
            <div>
              <div className="text-[10px] text-white/30">
                Workspace
              </div>

              <h1 className="text-sm font-semibold">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {user?.role === "admin" && <Link href="/king" className="hidden items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.05] hover:text-white sm:flex"><Shield size={14} />King</Link>}
              <Link href="/crm" className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.05] hover:text-white"><Users size={14} />CRM</Link>
              <Link href="/maintenance/new" className="hidden items-center gap-2 rounded-xl border border-cyan-300/20 px-3 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.08] sm:flex"><Code2 size={14} />Maintain app</Link>
              <Link href="/projects/new" className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:bg-cyan-50"><Plus size={14} />New project</Link>
              <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/55 hover:text-white" type="button" title="Sign out"><LogOut size={14} /><span className="hidden sm:inline">Sign out</span></button>
            </div>
          </header>

          <div className="p-5 lg:p-8">

            <div className="mb-8">
              <div className="text-xs font-medium text-cyan-300">
                AI Software + Sales Factory
              </div>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                One workspace. Two growth engines.
              </h2>

              <p className="mt-2 text-sm text-white/35">
                Turn product ideas into working software and manage your sales pipeline from the same HexaWave workspace.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              {dashboardStats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-white/30">
                      {label}
                    </span>

                    <Icon size={15} className="text-cyan-300" />
                  </div>

                  <div className="mt-4 text-2xl font-semibold">
                    {value}
                  </div>
                </div>
              ))}

            </div>

            <section
              aria-labelledby="sales-factory-heading"
              className="mt-6 rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.06] to-blue-500/[0.025] p-5 lg:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                    <Users size={15} className="text-cyan-300" />
                    <h3 id="sales-factory-heading">AI Sales Factory</h3>
                  </div>
                  <p className="mt-2 max-w-2xl text-[10px] leading-5 text-white/40">
                    Review real CRM activity and integration readiness. Providers that need credentials are clearly marked as not configured.
                  </p>
                </div>
                <Link
                  href="/crm"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold text-white/75 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Open Sales Factory
                  <ArrowUpRight size={13} />
                </Link>
              </div>

              {salesError && (
                <p role="alert" className="mt-4 text-[10px] text-red-300">
                  {salesError}
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "CRM leads",
                    value: crmStats ? String(crmStats.totalLeads) : "—",
                    detail: crmStats ? `${crmStats.interested} interested · ${crmStats.customers} customers` : "Metrics unavailable",
                  },
                  {
                    label: "Lead discovery",
                    value: discoveryStatus
                      ? discoveryStatus.providerConfigured ? "Connected" : "Setup required"
                      : "Unavailable",
                    detail: discoveryStatus
                      ? discoveryStatus.provider
                      : "Could not check provider",
                  },
                  {
                    label: "Inbound email",
                    value: emailStatus
                      ? emailStatus.inboundConfigured ? "Configured" : "Setup required"
                      : "Unavailable",
                    detail: emailStatus
                      ? "Cloudflare Email Routing"
                      : "Could not check integration",
                  },
                  {
                    label: "Outbound email",
                    value: emailStatus
                      ? emailStatus.outboundConfigured ? "Configured" : "Not configured"
                      : "Unavailable",
                    detail: "No outbound provider configured",
                  },
                ].map(({ label, value, detail }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-black/15 p-4"
                  >
                    <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/35">
                      {label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/80">
                      {value}
                    </div>
                    <div className="mt-1 truncate text-[9px] text-white/35">
                      {detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">

              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">

                <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Recent projects
                    </h3>

                    <p className="mt-1 text-[10px] text-white/25">
                      Continue building your applications.
                    </p>
                  </div>

                  <Link href="/dashboard" className="text-[10px] text-cyan-300">
                    View all
                  </Link>
                </div>

                <div className="divide-y divide-white/[0.05]">

                  {loading ? (
                    <p className="p-5 text-xs text-white/40">Loading projects…</p>
                  ) : loadError ? (
                    <p role="alert" className="p-5 text-xs text-red-300">{loadError}</p>
                  ) : projects.length === 0 ? (
                    <div className="p-5">
                      <p className="text-xs text-white/45">No projects yet.</p>
                      <Link href="/projects/new" className="mt-3 inline-flex text-xs text-cyan-300">
                        Create your first project
                      </Link>
                    </div>
                  ) : projects.slice(0, 5).map((project) => (
                    <Link
                      href={`/ai-developer?id=${encodeURIComponent(project.id)}`}
                      key={project.id}
                      className="flex flex-col gap-4 p-5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="flex items-center gap-4">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                          <Code2 size={17} className="text-cyan-300" />
                        </div>

                        <div>
                          <div className="text-xs font-medium">
                            {project.name}
                          </div>

                          <div className="mt-1 text-[9px] text-white/25">
                            {project.stack || project.type}
                          </div>
                        </div>

                      </div>

                      <div className="w-full sm:w-40">

                        <div className="mb-1 flex justify-between text-[9px]">
                          <span className="text-white/25">
                            {formatStatus(project.status)}
                          </span>

                          <span className="text-white/35">
                            {project.status === "running"
                              ? `Port ${project.process?.port ?? "—"}`
                              : project.status === "failed"
                                ? "Action required"
                                : new Date(project.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                      </div>

                      <ArrowUpRight
                        size={15}
                        className="hidden text-white/20 sm:block"
                      />

                    </Link>
                  ))}

                </div>
              </div>

              <div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.08] to-blue-500/[0.03] p-6">

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Bot size={16} className="text-cyan-300" />
                  AI Developer
                </div>

                <h3 className="mt-5 text-xl font-semibold">
                  What do you want to build?
                </h3>

                <p className="mt-3 text-xs leading-6 text-white/35">
                  Describe your application and HexaWave will help plan,
                  generate and improve your software.
                </p>

                <Link
                  href="/projects/new"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-bold text-black"
                >
                  <Sparkles size={14} />
                  Start with AI
                </Link>

              </div>

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
