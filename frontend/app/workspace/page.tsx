"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Copy,
  Code2,
  FolderKanban,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  getCurrentUser,
  getCompanyProfile,
  getProjects,
  logout,
  rotateCompanyInvite,
  type AuthUser,
  type CompanyProfile,
  type ProjectSummary,
} from "@/lib/api";

export default function WorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [currentUser, ownedProjects] = await Promise.all([
        getCurrentUser(),
        getProjects(),
      ]);
      setUser(currentUser);
      setProjects(ownedProjects);
      if (currentUser.accountType === "company") {
        const companyProfile = await getCompanyProfile();
        setCompany(companyProfile);
        const newCompanyInvite = window.sessionStorage.getItem(
          "hexawave-new-company-invite",
        );
        if (newCompanyInvite) {
          setInviteCode(newCompanyInvite);
          window.sessionStorage.removeItem("hexawave-new-company-invite");
        }
      } else {
        setCompany(null);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateInviteCode() {
    setInviteBusy(true);
    setCompanyError("");
    setInviteCopied(false);
    try {
      const result = await rotateCompanyInvite();
      setInviteCode(result.inviteCode);
    } catch (reason) {
      setCompanyError(
        reason instanceof Error ? reason.message : "Could not generate an invite code.",
      );
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      setCompanyError("");
    } catch (reason) {
      setCompanyError(
        reason instanceof Error ? `Could not copy invite code: ${reason.message}` : "Could not copy invite code.",
      );
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function signOut() {
    try {
      await logout();
      router.replace("/login");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not sign out.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.08] pb-7">
          <div>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300"
            >
              HexaWave
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {company ? `${company.name} workspace` : "Your private workspace"}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              {user
                ? `Signed in as ${user.name} · ${user.email}`
                : "Your private software projects"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 hover:text-white"
              type="button"
            >
              <LogOut size={15} /> Sign out
            </button>
            <Link
              href="/software-requests"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:text-white"
            >
              Company requests
            </Link>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:text-white"
            >
              AI credits
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200"
            >
              <Plus size={16} /> New project
            </Link>
          </div>
        </header>

        {company && (
          <section className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                  {company.isOwner ? "CEO company dashboard" : "Company team dashboard"}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{company.name}</h2>
                <p className="mt-2 text-xs text-white/45">
                  {company.memberCount} team {company.memberCount === 1 ? "member" : "members"} · projects in this workspace are shared only with this company.
                </p>
              </div>
              {company.isOwner && (
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void generateInviteCode()}
                  className="rounded-xl border border-cyan-300/25 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                >
                  {inviteBusy ? "Generating…" : inviteCode ? "Rotate employee invite" : "Create employee invite"}
                </button>
              )}
            </div>
            {company.isOwner && inviteCode && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold text-white/75">Employee invite code</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="break-all text-sm text-cyan-100">{inviteCode}</code>
                  <button
                    type="button"
                    onClick={() => void copyInviteCode()}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"
                  >
                    <Copy size={13} /> {inviteCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-white/40">
                  Share privately with employees. Creating a new code immediately invalidates the previous one.
                </p>
              </div>
            )}
            {companyError && (
              <p className="mt-3 text-xs text-rose-200" role="alert">{companyError}</p>
            )}
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-200">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Build with the AI Developer</h2>
                <p className="mt-1 text-sm text-white/50">
                  {company
                    ? `Build in the IDE shared only with ${company.name} team members.`
                    : "Build in your private IDE workspace. Your projects are isolated from other accounts."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/ai-developer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white"
              >
                Open AI Developer
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-9 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Projects</h2>
            <p className="mt-1 text-xs text-white/40">
              {company
                ? `Projects belong to ${company.name} and are shared only with its members.`
                : "Only your private projects are shown; other individual workspaces are isolated."}
            </p>
          </div>
          <button
            onClick={() => void loadWorkspace()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white"
            type="button"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {error && (
          <p
            className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-14 text-center text-sm text-white/45">
            Loading your projects…
          </p>
        ) : projects.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <FolderKanban className="mx-auto text-white/30" size={28} />
            <h3 className="mt-4 font-semibold">No projects yet</h3>
            <p className="mt-2 text-sm text-white/45">
              {company
                ? "Create the first project for your company team or import an existing application."
                : "Start a private project or import an existing application."}
            </p>
            <Link
              href="/projects/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-100"
            >
              <Plus size={15} /> Create your first project
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-cyan-200">
                      <Code2 size={17} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{project.name}</h3>
                      <p className="mt-1 text-xs text-white/40">
                        {project.type} · {project.stack}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] capitalize text-white/60">
                    {project.status}
                  </span>
                </div>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-white/50">
                  {project.description || "No description"}
                </p>
                <Link
                  href={`/ai-developer?id=${encodeURIComponent(project.id)}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white"
                >
                  Open in IDE <ArrowUpRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        )}

        {company?.isOwner && (
          <section className="mt-6 rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  CEO team dashboard
                </p>
                <h2 className="mt-1 text-lg font-semibold">Employees</h2>
                <p className="mt-1 text-xs text-white/45">
                  This roster is private to your company workspace.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">
                {company.employees?.length ?? 0} employees
              </span>
            </div>
            {company.employees?.length ? (
              <ul className="mt-4 divide-y divide-white/[0.07]">
                {company.employees.map((employee) => (
                  <li
                    key={employee.email}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span className="font-medium text-white/80">{employee.name}</span>
                    <span className="text-white/45">{employee.email}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/45">
                No employees have joined yet. Create an invite code above to add your team.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
