"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  createLead,
  getCrmStats,
  getEmailIntegrationStatus,
  getLeadDiscoveryStatus,
  getLeads,
  runLeadDiscovery,
  scoreLead,
  setLeadDiscoverySchedule,
  stopLeadDiscovery,
  suppressLead,
} from "@/lib/api";
import type {
  CrmStats,
  DiscoveryTargets,
  EmailIntegrationStatus,
  Lead,
  LeadDiscoveryStatus,
  LeadSizeSegment,
} from "@/src/types/crm";

const protectedStatuses = new Set(["UNSUBSCRIBED", "BOUNCED", "INVALID", "SUPPRESSED"]);

const emptyStats: CrmStats = {
  totalLeads: 0,
  newLeads: 0,
  qualifiedLeads: 0,
  contacted: 0,
  replied: 0,
  interested: 0,
  meetingRequested: 0,
  customers: 0,
  notInterested: 0,
  unsubscribed: 0,
  suppressed: 0,
  byStatus: {
    DISCOVERED: 0,
    RESEARCHING: 0,
    QUALIFIED: 0,
    READY_TO_CONTACT: 0,
    CONTACTED: 0,
    FOLLOW_UP: 0,
    REPLIED: 0,
    INTERESTED: 0,
    MEETING_REQUESTED: 0,
    CUSTOMER: 0,
    NOT_INTERESTED: 0,
    UNSUBSCRIBED: 0,
    BOUNCED: 0,
    INVALID: 0,
    SUPPRESSED: 0,
  },
};

function displayStatus(status: string): string {
  return status.toLowerCase().replaceAll("_", " ");
}

async function fetchCrmData() {
  const [leads, stats, emailStatus, discoveryStatus] = await Promise.all([
    getLeads(),
    getCrmStats(),
    getEmailIntegrationStatus(),
    getLeadDiscoveryStatus(),
  ]);
  return { leads, stats, emailStatus, discoveryStatus };
}

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<CrmStats>(emptyStats);
  const [emailStatus, setEmailStatus] = useState<EmailIntegrationStatus | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<LeadDiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scoringId, setScoringId] = useState("");
  const [suppressingId, setSuppressingId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [industries, setIndustries] = useState("software, technology, healthcare, manufacturing");
  const [sizeSegments, setSizeSegments] = useState<LeadSizeSegment[]>(["small", "medium", "large"]);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const data = await fetchCrmData();
      setLeads(data.leads);
      setStats(data.stats);
      setEmailStatus(data.emailStatus);
      setDiscoveryStatus(data.discoveryStatus);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "Could not load CRM data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCrmData()
      .then((data) => {
        if (!active) return;
        setLeads(data.leads);
        setStats(data.stats);
        setEmailStatus(data.emailStatus);
        setDiscoveryStatus(data.discoveryStatus);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load CRM data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function currentDiscoveryTargets(): DiscoveryTargets {
    return {
      industries: industries.split(",").map((item) => item.trim()).filter(Boolean),
      sizeSegments,
    };
  }

  async function handleDiscover() {
    setDiscoveryBusy(true);
    setActionError("");
    try {
      await runLeadDiscovery(currentDiscoveryTargets());
      await refresh();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Lead discovery failed.");
      await refresh();
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function handleScheduleToggle() {
    if (!discoveryStatus) return;
    setDiscoveryBusy(true);
    setActionError("");
    try {
      const updated = await setLeadDiscoverySchedule(
        !discoveryStatus.scheduleEnabled,
        currentDiscoveryTargets(),
      );
      setDiscoveryStatus(updated);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not update daily discovery.");
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function handleStopDiscovery() {
    setDiscoveryBusy(true);
    setActionError("");
    try {
      await stopLeadDiscovery();
      await refresh();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not stop lead discovery.");
    } finally {
      setDiscoveryBusy(false);
    }
  }

  const cards = useMemo(
    () => [
      { label: "Total leads", value: stats.totalLeads, icon: Users },
      { label: "Qualified", value: stats.qualifiedLeads, icon: Target },
      { label: "Replies", value: stats.replied, icon: Mail },
      { label: "Customers", value: stats.customers, icon: CheckCircle2 },
    ],
    [stats],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await createLead({
        companyName,
        contactName: contactName || undefined,
        jobTitle: jobTitle || undefined,
        email: email || undefined,
        industry: industry || undefined,
        website: website || undefined,
      });
      setCompanyName("");
      setContactName("");
      setJobTitle("");
      setEmail("");
      setIndustry("");
      setWebsite("");
      await refresh();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not create lead.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScore(lead: Lead) {
    setScoringId(lead.id);
    setActionError("");
    try {
      const scored = await scoreLead(lead.id);
      setLeads((current) => current.map((item) => item.id === scored.id ? scored : item));
      setStats(await getCrmStats());
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not score lead.");
    } finally {
      setScoringId("");
    }
  }

  async function handleSuppress(lead: Lead) {
    setSuppressingId(lead.id);
    setActionError("");
    try {
      const suppressed = await suppressLead(lead.id, "manual CRM suppression");
      setLeads((current) => current.map((item) => item.id === suppressed.id ? suppressed : item));
      setStats(await getCrmStats());
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not suppress lead.");
    } finally {
      setSuppressingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <header className="flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#080a10]/90 px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="text-sm font-bold">Hexa<span className="text-cyan-300">Wave</span></div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/35">AI Sales Factory</div>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-xs text-white/50">
          <Link className="transition hover:text-white" href="/dashboard">Software Factory</Link>
          <span className="text-cyan-300">CRM</span>
          <Link className="transition hover:text-white" href="/ai-developer">AI Developer</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <Activity size={13} /> Sales workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Lead CRM</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/45">
              Track prospects, record explainable qualification signals, and honor suppression states.
            </p>
            <p className="mt-2 text-[11px] text-amber-200/70">
              MVP storage is in-memory; restarting the backend clears lead records and audit history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:bg-white/[0.05] hover:text-white"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loadError && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200">
            CRM data could not be loaded: {loadError}
          </div>
        )}
        {actionError && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        <section aria-label="CRM metrics" className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between text-xs text-white/45">
                {label}
                <Icon size={16} className="text-cyan-300/80" />
              </div>
              <div className="mt-4 text-3xl font-semibold">{loading || loadError ? "—" : value}</div>
              <div className="mt-2 text-[11px] text-white/30">
                {label === "Total leads" ? `${stats.newLeads} newly discovered` : "Live from CRM records"}
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="lead-discovery-heading" className="mb-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
                <Search size={17} />
              </div>
              <div>
                <h2 id="lead-discovery-heading" className="text-sm font-semibold">Google lead discovery</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-white/40">
                  Search public Google results for India and international markets. Results are unverified prospects; size is a search segment, not a verified company fact.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {discoveryStatus?.lastRun.status === "running" ? (
                <button
                  type="button"
                  disabled={discoveryBusy}
                  onClick={() => void handleStopDiscovery()}
                  className="rounded-lg border border-rose-300/25 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-300/10 disabled:opacity-50"
                >
                  Stop search
                </button>
              ) : (
                <button
                  type="button"
                  disabled={discoveryBusy || !discoveryStatus?.providerConfigured || sizeSegments.length === 0}
                  onClick={() => void handleDiscover()}
                  className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {discoveryBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                  Discover now
                </button>
              )}
              <button
                type="button"
                disabled={discoveryBusy || !discoveryStatus?.providerConfigured}
                onClick={() => void handleScheduleToggle()}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {discoveryStatus?.scheduleEnabled ? "Disable daily" : "Enable daily"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)]">
            <label className="block text-[11px] text-white/50">
              Target industries (comma separated)
              <input
                value={industries}
                onChange={(event) => setIndustries(event.target.value)}
                maxLength={640}
                placeholder="software, healthcare, manufacturing"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/40"
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-[11px] text-white/50">Company-size search segments</legend>
              <div className="flex flex-wrap gap-2">
                {(["small", "medium", "large"] as const).map((segment) => (
                  <label key={segment} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs capitalize text-white/65">
                    <input
                      type="checkbox"
                      checked={sizeSegments.includes(segment)}
                      onChange={(event) => setSizeSegments((current) =>
                        event.target.checked
                          ? [...current, segment]
                          : current.filter((item) => item !== segment),
                      )}
                      className="accent-cyan-300"
                    />
                    {segment}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3 text-[11px]">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/40">
              <span>Provider: {discoveryStatus?.provider ?? "Checking"}</span>
              <span className={discoveryStatus?.providerConfigured ? "text-emerald-300" : "text-amber-200"}>
                {discoveryStatus
                  ? discoveryStatus.providerConfigured ? "API key configured" : "API key not configured"
                  : "Checking configuration"}
              </span>
              <span>
                Daily cap: {discoveryStatus?.dailyLeadsAdded ?? 0}/{discoveryStatus?.dailyLeadLimit ?? 30} leads
              </span>
              {discoveryStatus?.scheduleEnabled && discoveryStatus.nextRunAt && (
                <span>Next run: {new Date(discoveryStatus.nextRunAt).toLocaleString()}</span>
              )}
            </div>
            <span className="text-white/30">
              {discoveryStatus?.lastRun.status === "running"
                ? "Search running…"
                : discoveryStatus?.lastRun.completedAt
                  ? `Last run: ${discoveryStatus.lastRun.added} added, ${discoveryStatus.lastRun.skipped} skipped`
                  : "No searches run yet"}
            </span>
          </div>
          {discoveryStatus?.lastRun.error && (
            <p role="status" className="mt-2 text-xs text-amber-200/80">{discoveryStatus.lastRun.error}</p>
          )}
          {discoveryStatus && !discoveryStatus.providerConfigured && (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-xs leading-5 text-amber-100/75">
              <p className="font-semibold text-amber-100">Google discovery needs a SerpApi key.</p>
              <p className="mt-1">
                Add <code className="rounded bg-black/25 px-1 py-0.5">SERPAPI_API_KEY</code> to the private{" "}
                <code className="rounded bg-black/25 px-1 py-0.5">backend/.env</code> file, restart the backend, then refresh this page.
                Keep the key on the backend; do not paste it into this page or frontend settings.
              </p>
              <a
                className="mt-2 inline-flex font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-2 hover:text-white"
                href="https://serpapi.com/manage-api-key"
                rel="noreferrer"
                target="_blank"
              >
                Open SerpApi key settings
              </a>
            </div>
          )}
          {discoveryStatus?.providerConfigured && (
            <p className="mt-2 text-[10px] text-white/25">
              Daily automation is opt-in. Schedule settings and lead records are currently in-memory and reset when the backend restarts.
            </p>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Lead records</h2>
                <p className="mt-1 text-xs text-white/35">Suppressed records are excluded from outreach actions.</p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/45">{leads.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-white/35">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3 font-medium">Company / contact</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/[0.045] last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                            <Building2 size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white/85">{lead.companyName}</div>
                            <div className="mt-1 text-[11px] text-white/40">
                              {lead.contactName || "No contact"}{lead.jobTitle ? ` · ${lead.jobTitle}` : ""}
                            </div>
                            {lead.targetSizeSegment && (
                              <div className="mt-1 text-[10px] capitalize text-cyan-200/60">
                                {lead.targetSizeSegment} search segment · unverified
                              </div>
                            )}
                            {lead.sourceUrl && (
                              <a
                                href={lead.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block max-w-[280px] truncate text-[10px] text-cyan-200/60 hover:text-cyan-100"
                              >
                                View source
                              </a>
                            )}
                            {lead.email && <div className="mt-1 text-[11px] text-white/35">{lead.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {lead.qualification === "UNSCORED" ? (
                          <span className="text-white/30">Not scored</span>
                        ) : (
                          <span title={lead.scoreReasons.join("\n")} className="font-semibold text-cyan-200">
                            {lead.leadScore}<span className="ml-1 font-normal text-white/35">/100</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] capitalize text-white/60">
                          {displayStatus(lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/40">{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {!protectedStatuses.has(lead.status) && (
                            <>
                              <button
                                type="button"
                                disabled={scoringId === lead.id}
                                onClick={() => void handleScore(lead)}
                                className="rounded-lg border border-cyan-300/20 px-2.5 py-1.5 text-[10px] text-cyan-200 transition hover:bg-cyan-300/10 disabled:opacity-40"
                              >
                                {scoringId === lead.id ? <LoaderCircle size={13} className="animate-spin" /> : "Score"}
                              </button>
                              <button
                                type="button"
                                disabled={suppressingId === lead.id}
                                onClick={() => void handleSuppress(lead)}
                                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/45 transition hover:border-rose-300/30 hover:text-rose-200 disabled:opacity-40"
                              >
                                {suppressingId === lead.id ? "Saving…" : "Suppress"}
                              </button>
                            </>
                          )}
                          {protectedStatuses.has(lead.status) && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-200/70">
                              <ShieldCheck size={13} /> Excluded
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !loadError && leads.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <Users className="mx-auto text-white/25" size={24} />
                  <p className="mt-3 text-sm text-white/60">No leads yet</p>
                  <p className="mt-1 text-xs text-white/35">Add a record to start building your pipeline.</p>
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center gap-2 px-6 py-14 text-xs text-white/40">
                  <LoaderCircle size={15} className="animate-spin" /> Loading CRM records…
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Plus size={16} /></div>
                <div>
                  <h2 className="text-sm font-semibold">Add a lead</h2>
                  <p className="mt-0.5 text-[11px] text-white/35">Creates an in-memory lead record</p>
                </div>
              </div>
              <form onSubmit={(event) => void handleCreate(event)} className="space-y-3">
                <label className="block text-[11px] text-white/50">
                  Company name *
                  <input required maxLength={160} value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="Northstar Systems" />
                </label>
                <label className="block text-[11px] text-white/50">
                  Contact name
                  <input maxLength={160} value={contactName} onChange={(event) => setContactName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="Jordan Lee" />
                </label>
                <label className="block text-[11px] text-white/50">
                  Work email
                  <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="jordan@company.com" />
                </label>
                <label className="block text-[11px] text-white/50">
                  Job title
                  <input maxLength={160} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="Head of Engineering" />
                </label>
                <label className="block text-[11px] text-white/50">
                  Industry
                  <input maxLength={120} value={industry} onChange={(event) => setIndustry(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="Software" />
                </label>
                <label className="block text-[11px] text-white/50">
                  Website
                  <input type="url" maxLength={2048} value={website} onChange={(event) => setWebsite(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/40" placeholder="https://company.com" />
                </label>
                <button disabled={saving} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">
                  {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? "Saving lead…" : "Create lead"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-cyan-200" />
                <h2 className="text-sm font-semibold">Email integration</h2>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Cloudflare inbound</span>
                  <span className={emailStatus?.inboundConfigured ? "text-emerald-300" : "text-amber-200"}>
                    {emailStatus ? (emailStatus.inboundConfigured ? "Configured" : "Not configured") : "Checking"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Outbound sending</span>
                  <span className="text-white/35">Not configured</span>
                </div>
                <p className="border-t border-white/[0.06] pt-3 text-[11px] leading-5 text-white/35">
                  Inbound Worker events are signature-verified. Outbound email is intentionally disabled until a provider and compliance controls are configured.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
