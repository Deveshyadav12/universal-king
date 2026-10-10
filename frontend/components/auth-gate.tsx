"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getCurrentUser,
  getTradingAvailability,
  type AuthUser,
} from "@/lib/api";

function isProtectedPath(pathname: string): boolean {
  return [
    "/dashboard",
    "/crm",
    "/leads",
    "/trading",
    "/workspace",
    "/software-requests",
    "/projects",
    "/ai-developer",
    "/maintenance",
    "/king",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isKingPath(pathname: string): boolean {
  return pathname === "/king" || pathname.startsWith("/king/");
}

function isDashboardPath(pathname: string): boolean {
  return ["/dashboard", "/workspace", "/software-requests"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAdminOnlyPath(pathname: string): boolean {
  return ["/dashboard", "/crm", "/leads", "/trading"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const protectedPath = isProtectedPath(pathname);

  useEffect(() => {
    if (!protectedPath) {
      setChecking(false);
      setMessage("");
      setAuthorizedPath(null);
      return;
    }
    let active = true;
    setChecking(true);
    setMessage("");
    setAuthorizedPath(null);
    void getCurrentUser()
      .then((user: AuthUser) => {
        if (!active) return;
        if (user.role === "admin" && isDashboardPath(pathname) && !isKingPath(pathname)) {
          router.replace("/king");
        } else if (user.role !== "admin" && isKingPath(pathname)) {
          router.replace("/workspace");
        } else if (user.role !== "admin" && isAdminOnlyPath(pathname)) {
          router.replace("/workspace");
        } else if (pathname === "/trading" || pathname.startsWith("/trading/")) {
          void getTradingAvailability()
            .then(({ enabled }) => {
              if (!active) return;
              if (!enabled) {
                router.replace("/king");
                return;
              }
              setChecking(false);
              setAuthorizedPath(pathname);
            })
            .catch((error: unknown) => {
              if (!active) return;
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Could not verify trading availability.",
              );
              setChecking(false);
            });
        } else {
          setChecking(false);
          setAuthorizedPath(pathname);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const detail =
          error instanceof Error
            ? error.message
            : "Could not verify your session.";
        if (detail.includes("(401)")) {
          router.replace("/login");
          return;
        }
        setMessage(detail);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, protectedPath, retry, router]);

  if (!protectedPath || authorizedPath === pathname) return <>{children}</>;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a10] px-6 text-sm text-white/65">
      <div className="max-w-lg text-center">
        {checking ? "Verifying your HexaWave session…" : message}
        {message && (
          <button
            className="mt-4 block w-full text-cyan-200 underline"
            onClick={() => setRetry((attempt) => attempt + 1)}
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    </main>
  );
}
