"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import {
  authorizeFirstProjectDeployment,
  getProjectDeployment,
  previewProjectDeployment,
  saveProjectDeploymentConnection,
  testProjectDeploymentConnection,
  type ProjectDeploymentInfo,
} from "@/lib/api";

type Protocol = "ftp" | "ftps" | "sftp";

const statusStyles: Record<string, string> = {
  Pending: "text-white/65",
  Validating: "text-amber-200",
  "Connection Tested": "text-cyan-200",
  "Awaiting Authorization": "text-amber-200",
  Uploading: "text-cyan-200",
  Verifying: "text-cyan-200",
  Deployed: "text-emerald-300",
  Failed: "text-rose-200",
};

export default function DeploymentSettingsClientPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [deployment, setDeployment] = useState<ProjectDeploymentInfo | null>(null);
  const [protocol, setProtocol] = useState<Protocol>("ftps");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("21");
  const [username, setUsername] = useState("");
  const [remoteDirectory, setRemoteDirectory] = useState("/public_html");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [hostKeyFingerprint, setHostKeyFingerprint] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const applyDeploymentInfo = useCallback((result: ProjectDeploymentInfo) => {
    setDeployment(result);
    if (result.connection.configured) {
      setProtocol(result.connection.protocol ?? "ftps");
      setHost(result.connection.host ?? "");
      setPort(String(result.connection.port ?? 21));
      setRemoteDirectory(result.connection.remoteDirectory ?? "");
      setHostKeyFingerprint(result.connection.hostKeyFingerprint ?? "");
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await getProjectDeployment(projectId);
    applyDeploymentInfo(result);
  }, [applyDeploymentInfo, projectId]);

  useEffect(() => {
    void getProjectDeployment(projectId).then(applyDeploymentInfo).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not load deployment settings.");
    });
  }, [applyDeploymentInfo, projectId]);

  async function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const result = await saveProjectDeploymentConnection(projectId, {
        protocol,
        host,
        port: Number(port),
        username,
        remoteDirectory,
        ...(protocol === "sftp"
          ? {
              hostKeyFingerprint,
              ...(password ? { password } : {}),
              ...(privateKey ? { privateKey } : {}),
            }
          : { password }),
      });
      setPassword("");
      setPrivateKey("");
      setUsername("");
      setDeployment((current) =>
        current ? { ...current, connection: result.connection } : current,
      );
      await refresh();
      setNotice("Hosting connection saved. Credentials are encrypted and will not be shown again.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not save hosting connection.");
    } finally {
      setBusy("");
    }
  }

  async function testConnection() {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const result = await testProjectDeploymentConnection(projectId);
      await refresh();
      setNotice(`Connection and remote directory verified at ${new Date(result.checkedAt).toLocaleString()}. No files were uploaded.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Connection test failed.");
      await refresh().catch(() => undefined);
    } finally {
      setBusy("");
    }
  }

  async function createPreview() {
    setBusy("preview");
    setError("");
    setNotice("");
    try {
      const result = await previewProjectDeployment(projectId);
      await refresh();
      setNotice(result.preview.compatible
        ? "Preview ready. Review the files and authorize the first live deployment."
        : "Preview found blocking issues. Nothing was uploaded.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not create deployment preview.");
    } finally {
      setBusy("");
    }
  }

  async function authorizeDeployment() {
    setBusy("authorize");
    setError("");
    setNotice("");
    try {
      await authorizeFirstProjectDeployment(projectId);
      await refresh();
      setNotice("First-deployment authorization recorded. Upload remains blocked until the sandbox and verified artifact pipeline are available.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not authorize deployment.");
    } finally {
      setBusy("");
    }
  }

  function changeProtocol(value: Protocol) {
    setProtocol(value);
    setPort(value === "sftp" ? "22" : "21");
    setPassword("");
    setPrivateKey("");
  }

  return (
    <main className="min-h-screen bg-[#070a10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <Link href={`/ai-developer?id=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-xs text-cyan-300">
              <ArrowLeft size={14} /> Back to project
            </Link>
            <h1 className="mt-4 text-2xl font-semibold">Client hosting & deployment</h1>
            <p className="mt-2 text-sm text-white/45">Hosting credentials are isolated to this project and encrypted by the backend.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Refresh failed."))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/5"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-200">{notice}</p>}

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Deployment status</h2>
              <p className={`mt-2 text-sm ${statusStyles[deployment?.deployment.status ?? "Pending"]}`}>
                {deployment?.deployment.status ?? "Loading status…"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!deployment?.connection.configured || Boolean(busy)}
                onClick={() => void testConnection()}
                className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
              >
                {busy === "test" ? "Testing…" : "Test Connection"}
              </button>
              <button
                type="button"
                disabled={!deployment?.connection.configured || Boolean(busy)}
                onClick={() => void createPreview()}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 disabled:opacity-40"
              >
                {busy === "preview" ? "Checking…" : "Preview files"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/40">
            Connection tests only verify credentials and the remote directory. Preview checks filenames and compatibility; it does not execute project code or upload files.
          </p>
          {deployment?.deployment.firstDeploymentAuthorized && (
            <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 size={14} /> First live deployment authorization recorded.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="mb-5 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-cyan-200" size={18} />
            <div>
              <h2 className="font-semibold">Hosting connection</h2>
              <p className="mt-1 text-xs leading-5 text-white/40">
                Save one connection for this project. Passwords and keys are write-only; enter a new value to replace saved credentials.
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void saveConnection(event)} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-white/55">
              Protocol
              <select value={protocol} onChange={(event) => changeProtocol(event.target.value as Protocol)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090b10] px-3 py-2.5 text-white">
                <option value="ftp">FTP (unencrypted)</option>
                <option value="ftps">FTPS (TLS)</option>
                <option value="sftp">SFTP (SSH)</option>
              </select>
            </label>
            <label className="text-xs text-white/55">
              Host
              <input required maxLength={253} value={host} onChange={(event) => setHost(event.target.value)} placeholder="ftp.example.com" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
            </label>
            <label className="text-xs text-white/55">
              Port
              <input required type="number" min={1} max={65535} value={port} onChange={(event) => setPort(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
            </label>
            <label className="text-xs text-white/55">
              Username
              <input required maxLength={200} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
            </label>
            <label className="text-xs text-white/55 sm:col-span-2">
              Remote directory
              <input required maxLength={512} value={remoteDirectory} onChange={(event) => setRemoteDirectory(event.target.value)} placeholder="/public_html" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
            </label>
            {protocol === "sftp" ? (
              <>
                <label className="text-xs text-white/55 sm:col-span-2">
                  SSH private key
                  <textarea rows={5} value={privateKey} onChange={(event) => setPrivateKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder={deployment?.connection.hasCredentials ? "Saved key is hidden; paste a replacement to rotate it." : "Paste the private key"} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-xs text-white" />
                </label>
                <label className="text-xs text-white/55 sm:col-span-2">
                  Verified server SHA-256 fingerprint
                  <input required value={hostKeyFingerprint} onChange={(event) => setHostKeyFingerprint(event.target.value)} placeholder="SHA256:..." className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-white" />
                  <span className="mt-1 block text-[11px] text-white/35">Obtain this fingerprint from your hosting provider; it prevents connecting to an impersonated server.</span>
                </label>
                <label className="text-xs text-white/55 sm:col-span-2">
                  Or SFTP password
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder={deployment?.connection.hasCredentials ? "Saved credential is hidden; paste a replacement." : "Password"} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
                </label>
              </>
            ) : (
              <label className="text-xs text-white/55 sm:col-span-2">
                Password
                <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder={deployment?.connection.hasCredentials ? "Saved password is hidden; enter it again to replace." : "Password"} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
              </label>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50">
                {busy === "save" ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {busy === "save" ? "Saving securely…" : "Save Connection"}
              </button>
              {deployment?.connection.hasCredentials && (
                <span className="ml-3 text-[11px] text-emerald-300">Encrypted credentials saved</span>
              )}
            </div>
          </form>
        </section>

        {deployment?.deployment.preview && (
          <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <h2 className="font-semibold">Deployment preview</h2>
            <p className={`mt-2 text-xs ${deployment.deployment.preview.compatible ? "text-emerald-200" : "text-rose-200"}`}>
              {deployment.deployment.preview.compatible ? "Compatible preview" : "Blocked: review the issues below"}
            </p>
            {deployment.deployment.preview.blockers.map((item) => <p key={item} className="mt-2 text-xs leading-5 text-rose-200/80">{item}</p>)}
            {deployment.deployment.preview.warnings.map((item) => <p key={item} className="mt-2 text-xs leading-5 text-amber-100/70">{item}</p>)}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium text-white/65">Files to upload ({deployment.deployment.preview.files.length})</h3>
                <ul className="mt-2 max-h-52 overflow-auto rounded-lg bg-black/20 p-3 font-mono text-[11px] text-white/45">
                  {deployment.deployment.preview.files.map((file) => <li key={file}>{file}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium text-white/65">Excluded files ({deployment.deployment.preview.excludedFiles.length})</h3>
                <ul className="mt-2 max-h-52 overflow-auto rounded-lg bg-black/20 p-3 font-mono text-[11px] text-white/35">
                  {deployment.deployment.preview.excludedFiles.map((file) => <li key={file}>{file}</li>)}
                </ul>
              </div>
            </div>
            {deployment.deployment.preview.compatible && !deployment.deployment.firstDeploymentAuthorized && (
              <button type="button" disabled={Boolean(busy)} onClick={() => void authorizeDeployment()} className="mt-4 rounded-lg border border-amber-300/25 px-3 py-2 text-xs text-amber-100 hover:bg-amber-300/10 disabled:opacity-50">
                {busy === "authorize" ? "Recording authorization…" : "I authorize the first live deployment"}
              </button>
            )}
            <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/65">
              Live uploads are intentionally disabled until secure sandboxing and artifact verification are available. No project code is executed and no remote files are changed.
            </p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-center gap-2">
            <UploadCloud size={17} className="text-cyan-200" />
            <h2 className="font-semibold">Deployment activity</h2>
          </div>
          <ol className="mt-4 space-y-3">
            {deployment?.deployment.logs.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-l border-white/10 pl-3 text-xs">
                <span className={statusStyles[entry.status]}>{entry.status} · {entry.message}</span>
                <time className="text-white/30">{new Date(entry.timestamp).toLocaleString()}</time>
              </li>
            ))}
            {deployment?.deployment.logs.length === 0 && <li className="text-xs text-white/35">No deployment activity yet.</li>}
          </ol>
        </section>
      </div>
    </main>
  );
}
