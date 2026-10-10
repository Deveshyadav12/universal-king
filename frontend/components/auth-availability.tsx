"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { login, register, type AuthUser } from "@/lib/api";

type RegistrationKind = "individual" | "company-owner" | "company-employee";

export function AuthAvailability({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const [registrationKind, setRegistrationKind] =
    useState<RegistrationKind>("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let user: AuthUser;
      if (isLogin) {
        user = await login({ email, password });
      } else {
        const registration = await register({
          email,
          name,
          password,
          accountType:
            registrationKind === "individual" ? "individual" : "company",
          ...(registrationKind === "company-owner" ? { companyName } : {}),
          ...(registrationKind === "company-employee" ? { inviteCode } : {}),
        });
        user = registration.user;
        if (registration.companyInviteCode) {
          window.sessionStorage.setItem(
            "hexawave-new-company-invite",
            registration.companyInviteCode,
          );
        }
      }
      router.replace(user.role === "admin" ? "/king" : "/workspace");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Authentication failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-7xl items-center justify-center px-5 py-16 lg:px-8">
      <section className="w-full max-w-md rounded-3xl border border-white/[0.09] bg-[#0a0d14]/90 p-7 shadow-2xl sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200">
          <LockKeyhole size={19} />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
          {isLogin ? "Welcome back" : "Join HexaWave"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isLogin ? "Log in to your workspace" : "Create your account"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/45">
          {isLogin
            ? "Sign in to open your projects and continue building."
            : "Register to create private projects in your HexaWave workspace."}
        </p>

        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          {!isLogin && (
            <label className="block text-xs font-medium text-white/65">
              Name
              <input
                autoComplete="name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
                maxLength={100}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}
          {!isLogin && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-white/65">
                  Account type
                </legend>
                {([
                  ["individual", "Individual workspace"],
                  ["company-owner", "Company CEO — create company workspace"],
                  ["company-employee", "Company employee — join with invite code"],
                ] as const).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs text-white/70"
                  >
                    <input
                      checked={registrationKind === value}
                      name="registration-kind"
                      onChange={() => setRegistrationKind(value)}
                      type="radio"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {registrationKind === "company-owner" && (
                <label className="block text-xs font-medium text-white/65">
                  Company name
                  <input
                    autoComplete="organization"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
                    maxLength={120}
                    minLength={1}
                    onChange={(event) => setCompanyName(event.target.value)}
                    required
                    value={companyName}
                  />
                </label>
              )}
              {registrationKind === "company-employee" && (
                <label className="block text-xs font-medium text-white/65">
                  Company invite code
                  <input
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
                    maxLength={48}
                    minLength={48}
                    onChange={(event) => setInviteCode(event.target.value.trim())}
                    required
                    value={inviteCode}
                  />
                </label>
              )}
            </>
          )}
          <label className="block text-xs font-medium text-white/65">
            Email
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block text-xs font-medium text-white/65">
            Password
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
              maxLength={128}
              minLength={10}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {!isLogin && (
              <span className="mt-1 block text-[11px] text-white/35">
                Use at least 10 characters.
              </span>
            )}
          </label>
          {error && (
            <p
              className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Sparkles size={15} />
            )}
            {submitting
              ? "Please wait..."
              : isLogin
                ? "Log in"
                : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/45">
          {isLogin ? "New to HexaWave?" : "Already have an account?"}{" "}
          <Link
            className="font-semibold text-cyan-200 hover:text-white"
            href={isLogin ? "/register" : "/login"}
          >
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 text-xs text-white/45 hover:text-white"
        >
          <ArrowLeft size={13} /> Back to HexaWave
        </Link>
      </section>
    </main>
  );
}
