"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/app/bottom-nav";
import { TopBar } from "@/components/app/top-bar";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

function ToastHost() {
  const toast = useOkaneStore((s: OkaneState) => s.toast);
  const clearToast = useOkaneStore((s: OkaneState) => s.clearToast);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setOpen(true);
    const t = window.setTimeout(() => {
      setOpen(false);
      window.setTimeout(() => clearToast(), 220);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 top-4 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border bg-background/95 p-4 shadow-lg shadow-black/10 backdrop-blur transition-all",
        open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="text-sm font-semibold tracking-tight">{toast.title}</div>
      {toast.message ? (
        <div className="mt-1 text-sm text-muted-foreground">{toast.message}</div>
      ) : null}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  useAuthGuard();
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      {isOnboarding ? null : <TopBar />}
      <ToastHost />
      <main className={cn("mx-auto w-full max-w-md px-4", isOnboarding ? "py-8" : "pb-24 pt-5")}>
        {children}
      </main>
      {isOnboarding ? null : <BottomNav />}
    </div>
  );
}
