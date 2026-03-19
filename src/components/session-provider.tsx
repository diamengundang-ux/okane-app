"use client";

import type { ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

import { useAppStore } from "@/store/okane-store";

function SessionUserSync() {
  const { data: session, status } = useSession();
  const userEmail = status === "authenticated" ? session?.user?.email ?? null : null;
  const reset = useAppStore((s) => s.reset);
  const loadData = useAppStore((s) => s.loadData);
  const setActiveUserEmail = useAppStore((s) => s.setActiveUserEmail);

  useEffect(() => {
    setActiveUserEmail(userEmail);
    reset();
    if (!userEmail) return;
    void loadData();

    if (process.env.NODE_ENV !== "production") {
      console.log("Current user:", userEmail);
    }
  }, [loadData, reset, setActiveUserEmail, status, userEmail]);

  return null;
}

function SessionBoundary({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const userEmail = status === "authenticated" ? session?.user?.email ?? null : null;

  return (
    <>
      <SessionUserSync />
      <div key={userEmail ?? "signed-out"}>{children}</div>
    </>
  );
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionBoundary>{children}</SessionBoundary>
    </SessionProvider>
  );
}
