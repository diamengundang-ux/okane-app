"use client";

import type { ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

import { useAppStore } from "@/store/okane-store";

function SessionUserSync() {
  const { data: session, status } = useSession();
  const userEmail = session?.user?.email ?? null;
  const reset = useAppStore((s) => s.reset);
  const loadData = useAppStore((s) => s.loadData);
  const setActiveUserEmail = useAppStore((s) => s.setActiveUserEmail);

  useEffect(() => {
    if (status === "loading") return;
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

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionUserSync />
      {children}
    </SessionProvider>
  );
}
