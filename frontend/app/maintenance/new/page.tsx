"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileArchive, GitBranch, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  importMaintenanceZip,
  importPublicGithubRepository,
} from "@/lib/api";

const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected ZIP file."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the selected ZIP file."));
        return;
      }
      const separator = reader.result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Could not encode the selected ZIP file."));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function MaintenanceIntakePage() {
  const router = useRouter();
  const [source, setSource] = useState<"zip" | "github">("zip");
  const [projectName, setProjectName] = useState("");
  const [archive, setArchive] = useState<File | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function selectArchive(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setArchive(selected);
    setError(
      selected && selected.size > MAX_ARCHIVE_BYTES
        ? "ZIP files must be 5 MiB or smaller."
        : "",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);

    try {
      const result =
        source === "zip"
          ? await (async () => {
              if (!archive) throw new Error("Choose a project ZIP file.");
              if (archive.size > MAX_ARCHIVE_BYTES) {
                throw new Error("ZIP files must be 5 MiB or smaller.");
              }
              if (!archive.name.toLowerCase().endsWith(".zip")) {
                throw new Error("Choose a .zip archive.");
              }
              return importMaintenanceZip({
                projectName: projectName.trim() || archive.name.replace(/\.zip$/i, ""),
                archiveBase64: await fileAsBase64(archive),
              });
            })()
          : await importPublicGithubRepository(repositoryUrl.trim());

      const query = new URLSearchParams({
        id: result.project.id,
        project: result.project.name || projectName || "Existing application",
        type: result.project.type || "Existing App Maintenance",
        stack: result.project.stack || "Needs review",
        description: result.project.description || "Maintain imported application",
        mode: "maintenance",
      });
      router.push(`/ai-developer?${query.toString()}`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Project import failed.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft size={16} /> Dashboard
        </a>

        <div className="mt-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            HexaWave · Software maintenance
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Bring an existing app into your workspace.
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/55">
            Import a ZIP or a public GitHub repository, inspect its files in the
            IDE, then use the existing AI editor, build, run, preview, and
            download tools.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="mt-9 rounded-2xl border border-white/10 bg-[#0b0e15] p-5 sm:p-7"
        >
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setSource("zip")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm transition ${
                source === "zip" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              <FileArchive size={16} /> Upload ZIP
            </button>
            <button
              type="button"
              onClick={() => setSource("github")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm transition ${
                source === "github" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              <GitBranch size={16} /> Public GitHub
            </button>
          </div>

          {source === "zip" ? (
            <div className="mt-6 space-y-5">
              <label className="block text-sm text-white/75">
                Project name <span className="text-white/35">(optional)</span>
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  maxLength={120}
                  placeholder="e.g. Customer portal"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/50"
                />
              </label>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-5 py-6 text-center transition hover:border-cyan-300/40">
                <FileArchive size={24} className="text-cyan-300" />
                <span className="mt-3 text-sm font-medium">
                  {archive ? archive.name : "Choose a project ZIP"}
                </span>
                <span className="mt-1 text-xs text-white/40">
                  Maximum compressed size: 5 MiB
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={selectArchive}
                  className="sr-only"
                />
              </label>
            </div>
          ) : (
            <label className="mt-6 block text-sm text-white/75">
              Public repository URL
              <input
                type="url"
                required
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/50"
              />
              <span className="mt-2 block text-xs leading-5 text-white/40">
                Public repositories only for now. Private repositories require a
                secure GitHub authorization flow; never paste a personal access token.
              </span>
            </label>
          )}

          <div className="mt-6 flex gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4 text-xs leading-5 text-white/55">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" />
            <p>
              Import is limited to supported UTF-8 project files. Credential
              files and common generated/vendor folders are excluded; detected
              hard-coded secrets are rejected. The 48-hour goal is a target for
              scoped work, not a guaranteed completion promise.
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (source === "zip" && !archive)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Importing project…
              </>
            ) : (
              "Import and open in IDE"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
