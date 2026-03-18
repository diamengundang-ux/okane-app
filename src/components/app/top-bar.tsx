"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

function getNameFromEmail(email: string) {
  const base = email.split("@")[0] ?? "";
  const cleaned = base.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Kamu";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function TopBar() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name?.trim() || (email ? getNameFromEmail(email) : "Kamu");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">Okane</div>
          <div className="truncate text-xs text-muted-foreground">
            Halo, {name} 👋{email ? ` · ${email}` : ""}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
