"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

function getNameFromEmail(email: string) {
  const base = email.split("@")[0] ?? "";
  const cleaned = base.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Kamu";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function TopBar() {
  const user = useOkaneStore((s: OkaneState) => s.user);
  const signOut = useOkaneStore((s: OkaneState) => s.signOut);
  const name = user?.name?.trim() || (user?.email ? getNameFromEmail(user.email) : "Kamu");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">Okane</div>
          <div className="truncate text-xs text-muted-foreground">
            Halo, {name} 👋{user?.email ? ` · ${user.email}` : ""}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          aria-label="Sign out"
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
